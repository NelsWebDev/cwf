import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoundStatus } from "@repo/shared/types";

const mocks = vi.hoisted(() => ({
  loadCardImages: vi.fn(),
  renderRoundImage: vi.fn(),
  postImageToDiscord: vi.fn(),
}));
vi.mock("./cardImages", () => ({ loadCardImages: mocks.loadCardImages }));
vi.mock("./roundImage", () => ({ renderRoundImage: mocks.renderRoundImage }));
vi.mock("./discordWebhook", () => ({ postImageToDiscord: mocks.postImageToDiscord }));

import { shareRoundToDiscord } from "./shareRound";

const makeRound = (overrides = {}) =>
  ({
    status: RoundStatus.SHOWING_WINNER,
    sharedToDiscord: false,
    winnerId: "u1",
    blackCard: { text: "Prompt", pick: 1 },
    plays: { u1: [{ text: "A" }], u2: [{ text: "B" }] },
    ...overrides,
  }) as never as Parameters<typeof shareRoundToDiscord>[0] & { sharedToDiscord: boolean };

describe("shareRoundToDiscord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.loadCardImages.mockResolvedValue(new Map());
    mocks.renderRoundImage.mockReturnValue("png");
    mocks.postImageToDiscord.mockResolvedValue(undefined);
  });

  it("requires a finished round", async () => {
    await expect(shareRoundToDiscord(undefined, String)).rejects.toThrow("no finished round");
    await expect(
      shareRoundToDiscord(makeRound({ status: RoundStatus.SELECTING_WINNER }), String),
    ).rejects.toThrow("no finished round");
  });

  it("requires played cards", async () => {
    await expect(shareRoundToDiscord(makeRound({ plays: { u1: [] } }), String)).rejects.toThrow(
      "no played cards",
    );
  });

  it("only shares a round once", async () => {
    await expect(shareRoundToDiscord(makeRound({ sharedToDiscord: true }), String)).rejects.toThrow(
      "already shared",
    );
  });

  it("renders the plays with player names and posts the image", async () => {
    const round = makeRound();

    await shareRoundToDiscord(round, (id) => `name-${id}`);

    expect(mocks.loadCardImages).toHaveBeenCalledWith(["A", "B"]);
    expect(mocks.renderRoundImage).toHaveBeenCalledWith(
      expect.objectContaining({
        blackCardText: "Prompt",
        plays: [
          { username: "name-u1", cards: ["A"], isWinner: true },
          { username: "name-u2", cards: ["B"], isWinner: false },
        ],
      }),
    );
    expect(mocks.postImageToDiscord).toHaveBeenCalledWith("png", "round.png");
    expect(round!.sharedToDiscord).toBe(true);
  });

  it("lets the round be shared again after a failure", async () => {
    mocks.postImageToDiscord.mockRejectedValue(new Error("boom"));
    const round = makeRound();

    await expect(shareRoundToDiscord(round, String)).rejects.toThrow("Failed to share to Discord");
    expect(round!.sharedToDiscord).toBe(false);
  });
});
