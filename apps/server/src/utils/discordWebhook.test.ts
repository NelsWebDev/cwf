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

  it("posts the announcement with the current players and returns a message id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart(["@everyone", "bob"])).resolves.toBe(true);

    const [url, request] = fetchMock.mock.calls[0]!;
    expect((url as URL).searchParams.get("wait")).toBe("true");
    expect((url as URL).searchParams.get("with_components")).toBe("true");
    expect(JSON.parse(request.body)).toMatchObject({
      flags: 32768,
      components: [
        {
          components: [
            {},
            { content: "**Current Players:** @\u200beveryone, bob" },
            { content: "**Password:** test-password" },
          ],
          accessory: { label: "Join Game", url: "https://cards.nels.app" },
        },
      ],
    });
  });

  it("patches the announcement message when players change", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart, updateAnnouncedPlayers } = await loadAnnouncer();

    await announceGameStart(["a"]);
    await updateAnnouncedPlayers(["a", "b"]);

    const [url, request] = fetchMock.mock.calls[1]!;
    expect(request.method).toBe("PATCH");
    expect((url as URL).pathname).toBe("/webhook/messages/m1");
    expect((url as URL).searchParams.get("with_components")).toBe("true");
    expect(JSON.parse(request.body).components[0].components[1].content).toBe(
      "**Current Players:** a, b",
    );
  });

  it("deletes the announcement after the room has been empty for 3 minutes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart, updateAnnouncedPlayers } = await loadAnnouncer();

    await announceGameStart(["a"]);
    await updateAnnouncedPlayers([]);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    await updateAnnouncedPlayers(["a"]);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(fetchMock.mock.calls.some(([, r]) => r.method === "DELETE")).toBe(false);

    await updateAnnouncedPlayers([]);
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    const del = fetchMock.mock.calls.find(([, r]) => r.method === "DELETE")!;
    expect((del[0] as URL).pathname).toBe("/webhook/messages/m1");
    vi.useRealTimers();
  });

  it("does not patch before a game has been announced", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { updateAnnouncedPlayers } = await loadAnnouncer();

    await updateAnnouncedPlayers(["a"]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses the live announcement for a new game instead of reposting", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart(["a"])).resolves.toBe(true);
    await expect(announceGameStart(["a", "b"])).resolves.toBe(false);

    expect(fetchMock.mock.calls.map(([, r]) => r.method)).toEqual(["POST", "PATCH"]);
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

    const firstAnnouncement = announceGameStart(["first"]);
    await Promise.resolve();
    await expect(announceGameStart(["x"])).resolves.toBe(false);

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

    await expect(announceGameStart(["first"])).rejects.toThrow(
      "Discord webhook returned HTTP 500",
    );
    await expect(announceGameStart(["x"])).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports missing configuration instead of silently skipping the announcement", async () => {
    delete process.env.GAME_PASSWORD;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { announceGameStart } = await loadAnnouncer();

    await expect(announceGameStart(["x"])).rejects.toThrow(
      "GAME_PASSWORD is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("postImageToDiscord", () => {
  const original = process.env.DISCORD_WEBHOOK_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = original;
    vi.unstubAllGlobals();
  });

  it("uploads the image as multipart to the configured webhook with mentions disabled", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { postImageToDiscord } = await loadAnnouncer();

    await postImageToDiscord(Buffer.from([1, 2, 3]), "round.png");

    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://discord.example/webhook");
    expect(request.method).toBe("POST");
    const form = request.body as FormData;
    expect(JSON.parse(form.get("payload_json") as string)).toMatchObject({
      allowed_mentions: { parse: [] },
      attachments: [{ id: 0, filename: "round.png" }],
    });
    const file = form.get("files[0]") as File;
    expect(file.name).toBe("round.png");
    expect(file.type).toBe("image/png");
  });

  it("throws when the webhook is missing or rejects", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const { postImageToDiscord } = await loadAnnouncer();
    await expect(postImageToDiscord(Buffer.from([1]), "r.png")).rejects.toThrow("not configured");

    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/webhook";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(postImageToDiscord(Buffer.from([1]), "r.png")).rejects.toThrow("HTTP 500");
  });
});
