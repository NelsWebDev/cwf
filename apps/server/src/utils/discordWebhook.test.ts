import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
const originalGamePassword = process.env.GAME_PASSWORD;

const loadAnnouncer = async () => {
  vi.resetModules();
  return import("./discordWebhook");
};

describe("announceGameStart", () => {
  beforeEach(() => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook?wait=true";
    process.env.GAME_PASSWORD = "test-password";
    vi.spyOn(Date, "now").mockReturnValue(1_000);
  });

  afterEach(() => {
    if (originalWebhookUrl === undefined) {
      delete process.env.DISCORD_WEBHOOK_URL;
    } else {
      process.env.DISCORD_WEBHOOK_URL = originalWebhookUrl;
    }
    if (originalGamePassword === undefined) {
      delete process.env.GAME_PASSWORD;
    } else {
      process.env.GAME_PASSWORD = originalGamePassword;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the game announcement and neutralizes mentions in the username", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart("@everyone")).resolves.toBe(true);

    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).searchParams.get("wait")).toBe("true");
    expect((url as URL).searchParams.get("with_components")).toBe("true");
    expect(JSON.parse(request.body)).toMatchObject({
      flags: 32768,
      allowed_mentions: { parse: ["everyone"] },
      components: [
        {
          components: [
            {},
            { content: expect.stringContaining("@\u200beveryone") },
            { content: "**Password:** test-password" },
          ],
          accessory: {
            label: "Join Game",
            url: "https://cards.nels.app",
          },
        },
      ],
    });
  });

  it("limits successful announcements to one per cooldown window", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart("first")).resolves.toBe(true);
    now += 14 * 60 * 1000;
    await expect(announceGameStart("too soon")).resolves.toBe(false);
    now += 2 * 60 * 1000;
    await expect(announceGameStart("cooldown ended")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects concurrent announcements while a request is pending", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    const firstAnnouncement = announceGameStart("first");
    await Promise.resolve();
    await expect(announceGameStart("second")).resolves.toBe(false);

    resolveFetch(new Response(null, { status: 204 }));
    await expect(firstAnnouncement).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after the webhook request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart("first")).rejects.toThrow(
      "Discord webhook returned HTTP 500",
    );
    await expect(announceGameStart("retry")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports missing configuration instead of silently skipping the announcement", async () => {
    delete process.env.GAME_PASSWORD;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart("player")).rejects.toThrow(
      "GAME_PASSWORD is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
