import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeUsers: [] as unknown[],
  gameUsers: new Map(),
  publish: vi.fn(),
  prismaClient: {
    blackCard: { findMany: vi.fn() },
    whiteCard: { findMany: vi.fn() },
    deck: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("./singletons", () => ({
  prismaClient: mocks.prismaClient,
  socketManager: {
    get activeUsers() {
      return mocks.activeUsers;
    },
    gameUsers: mocks.gameUsers,
  },
  game: { started: false },
}));

vi.mock("./pubsub", () => ({
  publish: mocks.publish,
}));

import { Game } from "./Game";
import { CardState, DEFAULT_RULES, type WhiteCard } from "@repo/shared/types";

describe("Game", () => {
  beforeEach(() => {
    mocks.activeUsers.length = 0;
    mocks.publish.mockClear();
  });

  it("updates only the supplied rules and broadcasts the result", () => {
    const game = new Game();

    game.updateRules({ pointsToWin: 12, announceToDiscord: false });

    expect(game.rules).toEqual({
      ...DEFAULT_RULES,
      pointsToWin: 12,
      announceToDiscord: false,
    });
    expect(mocks.publish).toHaveBeenCalledWith("rules", game.rules);
  });

  it("does not allow rule changes after the game starts", () => {
    const game = new Game();
    game.started = true;

    expect(() => game.updateRules({ pointsToWin: 12 })).toThrow(
      "Game already started",
    );
    expect(game.rules.pointsToWin).toBe(DEFAULT_RULES.pointsToWin);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("returns zero for a player without a score", () => {
    expect(new Game().getPoints("unknown-player")).toBe(0);
  });

  it("draws only available white cards and marks them in use", () => {
    const game = new Game();
    const cards: WhiteCard[] = ["first", "second", "third"].map((id) => ({
      id,
      deckIds: [],
      text: id,
      isCustom: false,
      state: CardState.AVAILABLE,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }));
    cards[1]!.state = CardState.IN_USE;
    game._whiteCards = cards;

    expect(game.drawWhiteCards(2).map((card) => card.id)).toEqual([
      "first",
      "third",
    ]);
    expect(cards.map((card) => card.state)).toEqual([
      CardState.IN_USE,
      CardState.IN_USE,
      CardState.IN_USE,
    ]);
  });

  it("keeps previously played custom cards out of the reusable white-card deck", () => {
    const game = new Game();
    game._whiteCards = [
      {
        id: "custom",
        deckIds: [],
        text: "",
        isCustom: true,
        state: CardState.PLAYED_PREVIOUSLY,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: "standard",
        deckIds: [],
        text: "standard",
        isCustom: false,
        state: CardState.PLAYED_PREVIOUSLY,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];

    game.shuffleWhiteCards();

    expect(game._whiteCards.find((card) => card.id === "custom")?.state).toBe(
      CardState.PLAYED_PREVIOUSLY,
    );
    expect(game._whiteCards.find((card) => card.id === "standard")?.state).toBe(
      CardState.AVAILABLE,
    );
  });
});
