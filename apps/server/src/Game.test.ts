import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeUsers: [] as unknown[],
  gameUsers: new Map(),
  publish: vi.fn(),
  fetchDeck: vi.fn(),
  makeBlankWhiteCards: vi.fn((number: number) =>
    Array.from({ length: number }, (_, index) => ({
      id: `custom-${index}`,
      deckIds: [],
      text: "",
      isCustom: true,
      state: "AVAILABLE",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })),
  ),
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

vi.mock("./CardManager", () => ({
  CardManager: {
    fetchDeck: mocks.fetchDeck,
    makeBlankWhiteCards: mocks.makeBlankWhiteCards,
  },
}));

import { Game } from "./Game";
import { CardState, DEFAULT_RULES, type WhiteCard } from "@repo/shared/types";

const makePlayer = (id: string) => ({
  id,
  username: id,
  isActive: true,
  hand: new Map<string, WhiteCard>(),
  toJSON: () => ({
    id,
    username: id,
    isActive: true,
    points: 0,
    isCardCzar: false,
  }),
  addCardsToHand(cards: WhiteCard[]) {
    cards.forEach((card) => this.hand.set(card.id, card));
  },
  clearHand() {
    this.hand.clear();
  },
  newHandsUsed: 0,
  replaceHand(cards: WhiteCard[]) {
    this.hand = new Map(cards.map((card) => [card.id, card]));
  },
});

const makeBlackCards = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `black-${index}`,
    text: `Prompt ${index}`,
    pick: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    decksCards: [{ deckId: "deck-1" }],
  }));

const makeWhiteCards = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `white-${index}`,
    text: `Answer ${index}`,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    decksCards: [{ deckId: "deck-1" }],
  }));

describe("Game", () => {
  beforeEach(() => {
    mocks.activeUsers.length = 0;
    mocks.gameUsers.clear();
    mocks.publish.mockClear();
    mocks.fetchDeck.mockReset();
    mocks.makeBlankWhiteCards.mockClear();
    mocks.prismaClient.blackCard.findMany.mockReset();
    mocks.prismaClient.whiteCard.findMany.mockReset();
  });

  it("prevents starting when the game is already running", async () => {
    const game = new Game();
    game.started = true;

    await expect(game.start()).rejects.toThrow("Game has already started");
    expect(mocks.prismaClient.blackCard.findMany).not.toHaveBeenCalled();
  });

  it("requires at least three active players before starting", async () => {
    const game = new Game();
    mocks.activeUsers.push(makePlayer("one"), makePlayer("two"));

    await expect(game.start()).rejects.toThrow("Not enough players");
    expect(mocks.prismaClient.blackCard.findMany).not.toHaveBeenCalled();
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

  it("adds a deck once and broadcasts the configured decks", async () => {
    const game = new Game();
    const deck = {
      id: "deck-1",
      name: "Test deck",
      cahOfficial: false,
        numberOfBlackCards: 1,
      numberOfWhiteCards: 10,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    mocks.fetchDeck.mockResolvedValue(deck);

    await game.addDeck("deck-1");
    await game.addDeck("deck-1");

    expect(game.addedDecks).toEqual([deck]);
    expect(mocks.fetchDeck).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith("decks", [deck]);
  });

  it("rejects adding a deck that does not exist", async () => {
    const game = new Game();
    mocks.fetchDeck.mockResolvedValue(null);

    await expect(game.addDeck("missing")).rejects.toThrow("Deck not found");
    expect(game.addedDecks).toEqual([]);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("rejects deck changes after the game starts", async () => {
    const game = new Game();
    game.started = true;

    await expect(game.addDeck("deck-1")).rejects.toThrow("Game already started");
    expect(mocks.fetchDeck).not.toHaveBeenCalled();
    expect(() => game.removeDeck("deck-1")).toThrow("Game already started");
  });

  it("removes an existing deck and broadcasts the updated list", () => {
    const game = new Game();
    game.addedDecks = [
      {
        id: "deck-1",
        name: "Test deck",
        cahOfficial: false,
            numberOfBlackCards: 1,
        numberOfWhiteCards: 10,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];

    game.removeDeck("deck-1");

    expect(game.addedDecks).toEqual([]);
    expect(mocks.publish).toHaveBeenCalledWith("decks", []);
  });

  it("does not broadcast when removing a deck that is not configured", () => {
    const game = new Game();

    game.removeDeck("missing");

    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("returns zero for a player without a score", () => {
    expect(new Game().getPoints("unknown-player")).toBe(0);
  });

  it("reports the highest scoring player as the winner", () => {
    const game = new Game();
    const winner = makePlayer("winner");
    const runnerUp = makePlayer("runner-up");
    mocks.gameUsers.set(winner.id, winner);
    mocks.gameUsers.set(runnerUp.id, runnerUp);
    game._points.set(winner.id, 5);
    game._points.set(runnerUp.id, 3);

    expect(game.winningPlayer()).toBe(winner);
  });

  it("has no winner when there are no scores or the top scorer is missing", () => {
    const game = new Game();

    expect(game.winningPlayer()).toBeUndefined();

    game._points.set("missing-player", 3);
    expect(game.winningPlayer()).toBeUndefined();
  });

  it("rotates the czar through active players and wraps back to the first", () => {
    const game = new Game();
    const players = [makePlayer("one"), makePlayer("two"), makePlayer("three")];
    mocks.activeUsers.push(...players);
    game._currentCzar = players[0] as never;

    expect(game.getNextCzar()).toBe(players[1]);
    game._currentCzar = players[2] as never;
    expect(game.getNextCzar()).toBe(players[0]);
  });

  it("selects the first active player when the current czar is no longer active", () => {
    const game = new Game();
    const players = [makePlayer("one"), makePlayer("two")];
    mocks.activeUsers.push(...players);
    game._currentCzar = makePlayer("disconnected") as never;

    expect(game.getNextCzar()).toBe(players[0]);
  });

  it("rejects czar selection when no players are active", () => {
    expect(() => new Game().getNextCzar()).toThrow("No players");
  });

  it("requires enough black cards to support the configured winning score", async () => {
    const game = new Game();
    const players = [makePlayer("one"), makePlayer("two"), makePlayer("three")];
    mocks.activeUsers.push(...players);
    game.rules.pointsToWin = 2;
    mocks.prismaClient.blackCard.findMany.mockResolvedValue(makeBlackCards(3));
    mocks.prismaClient.whiteCard.findMany.mockResolvedValue(makeWhiteCards(50));

    await expect(game.start()).rejects.toThrow("Not enough black cards");
    expect(game.started).toBe(false);
    expect(game._blackCards).toEqual([]);
  });

  it("requires enough white cards to deal hands and support future rounds", async () => {
    const game = new Game();
    mocks.activeUsers.push(makePlayer("one"), makePlayer("two"), makePlayer("three"));
    game.rules.pointsToWin = 1;
    mocks.prismaClient.blackCard.findMany.mockResolvedValue(makeBlackCards(3));
    mocks.prismaClient.whiteCard.findMany.mockResolvedValue(makeWhiteCards(31));

    await expect(game.start()).rejects.toThrow(
      "Need 32 white cards but only got 31",
    );
    expect(game.started).toBe(false);
  });

  it("starts a game, deals ten cards to each player, and creates its first round", async () => {
    const game = new Game();
    const players = [makePlayer("one"), makePlayer("two"), makePlayer("three")];
    mocks.activeUsers.push(...players);
    game.rules.pointsToWin = 1;
    game.addedDecks = [
      {
        id: "deck-1",
        name: "Test deck",
        cahOfficial: false,
            numberOfBlackCards: 3,
        numberOfWhiteCards: 32,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];
    mocks.prismaClient.blackCard.findMany.mockResolvedValue(makeBlackCards(3));
    mocks.prismaClient.whiteCard.findMany.mockResolvedValue(makeWhiteCards(32));
    vi.spyOn(Math, "random").mockReturnValue(0);

    await game.start();

    expect(game.started).toBe(true);
    expect(players.map((player) => player.hand.size)).toEqual([10, 10, 10]);
    expect(game.currentCardCzar).toBe(players[0]);
    expect(game.currentRound?.blackCard.state).toBe(CardState.IN_USE);
    expect(game.currentRound?.status).toBe("WAITING_FOR_PLAYERS");
    expect(game._whiteCards.filter((card) => card.state === CardState.IN_USE)).toHaveLength(30);
    expect(mocks.prismaClient.blackCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          decksCards: { some: { deckId: { in: ["deck-1"] } } },
        }),
      }),
    );
    expect(mocks.publish).toHaveBeenCalledWith("game", expect.objectContaining({ started: true }));
  });

  it("filters black cards to single-answer prompts when that rule is disabled", async () => {
    const game = new Game();
    mocks.activeUsers.push(makePlayer("one"), makePlayer("two"), makePlayer("three"));
    game.rules = { ...DEFAULT_RULES, pointsToWin: 1, allowMultipleAnswerBlackCards: false };
    mocks.prismaClient.blackCard.findMany.mockResolvedValue(makeBlackCards(1));
    mocks.prismaClient.whiteCard.findMany.mockResolvedValue(makeWhiteCards(32));
    vi.spyOn(Math, "random").mockReturnValue(0);

    await game.start();

    expect(mocks.prismaClient.blackCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pick: 1 }) }),
    );
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

  it.each(["WAITING_FOR_PLAYERS", "SELECTING_WINNER"])(
    "returns submitted cards and replaces the round when skipping during %s",
    (status) => {
      const game = new Game();
      const player = makePlayer("player");
      const card = {
        id: "submitted-card",
        deckIds: [],
        text: "custom answer",
        isCustom: true,
        state: CardState.IN_USE,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
      mocks.activeUsers.push(player);
      mocks.gameUsers.set(player.id, player);

      const skippedBlackCard = {
        id: "skipped-black",
        deckIds: [],
        text: "Skipped prompt",
        pick: 1,
        state: CardState.IN_USE,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
      const nextBlackCard = {
        ...skippedBlackCard,
        id: "next-black",
        state: CardState.AVAILABLE,
      };
      game._blackCards = [nextBlackCard];
      game._currentRound = {
        blackCard: skippedBlackCard,
        cardCzar: makePlayer("czar"),
        status,
        plays: { [player.id]: [card] },
      } as never;

      game.skipBlackCard();

      expect(skippedBlackCard.state).toBe(CardState.SKIPPED);
      expect(card.text).toBe("");
      expect(player.hand.get(card.id)).toBe(card);
      expect(game.currentRound?.blackCard).toBe(nextBlackCard);
      expect(game.currentRound?.plays).toEqual({});
      expect(mocks.publish).toHaveBeenCalledWith(
        "game",
        expect.objectContaining({
          currentRound: expect.objectContaining({ blackCard: nextBlackCard }),
        }),
      );
    },
  );

  it("ends the game by clearing cards, scores, hands, and the current round", () => {
    const game = new Game();
    const winner = makePlayer("winner");
    winner.hand.set("hand-card", {
      id: "hand-card",
      deckIds: [],
      text: "answer",
      isCustom: false,
      state: CardState.IN_USE,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    mocks.gameUsers.set(winner.id, winner);
    game._points.set(winner.id, 4);
    game._whiteCards = [{} as WhiteCard];
    game._blackCards = [{} as never];
    game.started = true;
    game._currentCzar = winner as never;
    game._currentRound = {} as never;

    game.endGame();

    expect(game.started).toBe(false);
    expect(game._points.size).toBe(0);
    expect(game._whiteCards).toEqual([]);
    expect(game._blackCards).toEqual([]);
    expect(game.currentCardCzar).toBeUndefined();
    expect(game.currentRound).toBeUndefined();
    expect(winner.hand.size).toBe(0);
    expect(mocks.publish).toHaveBeenCalledWith("gameEnded", "winner");
  });

  describe("requestNewHand", () => {
    const makeCard = (id: string, state = CardState.AVAILABLE): WhiteCard => ({
      id,
      deckIds: [],
      text: id,
      isCustom: false,
      state,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const setup = () => {
      const game = new Game();
      game.rules.newHandsPerGame = 2;
      const player = makePlayer("player");
      const oldCards = Array.from({ length: 10 }, (_, i) => makeCard(`old-${i}`, CardState.IN_USE));
      oldCards.forEach((card) => player.hand.set(card.id, card));
      mocks.gameUsers.set(player.id, player);
      mocks.activeUsers.push(player);
      game.started = true;
      game._whiteCards = Array.from({ length: 40 }, (_, i) => makeCard(`new-${i}`));
      game._currentRound = {
        assertCanSitOut: vi.fn(),
        sitOut: vi.fn(),
      } as never;
      return { game, player, oldCards };
    };

    it("replaces the whole hand and sits the player out", () => {
      const { game, player, oldCards } = setup();

      game.requestNewHand(player.id);

      expect(player.hand.size).toBe(10);
      expect([...player.hand.keys()].every((id) => id.startsWith("new-"))).toBe(true);
      expect(oldCards.every((card) => card.state === CardState.PLAYED_PREVIOUSLY)).toBe(true);
      expect(player.newHandsUsed).toBe(1);
      expect(game._currentRound?.sitOut).toHaveBeenCalledWith(player.id);
    });

    it("allows only two new hands per game", () => {
      const { game, player } = setup();

      game.requestNewHand(player.id);
      game.requestNewHand(player.id);
      const hand = new Map(player.hand);

      expect(() => game.requestNewHand(player.id)).toThrow("No new hands remaining");
      expect(player.hand).toEqual(hand);
      expect(player.newHandsUsed).toBe(2);
    });

    it("is disabled by default", () => {
      const { game, player } = setup();
      game.rules = { ...DEFAULT_RULES };

      expect(DEFAULT_RULES.newHandsPerGame).toBe(0);
      expect(() => game.requestNewHand(player.id)).toThrow("No new hands remaining");
      expect(player.hand.size).toBe(10);
    });

    it("rejects requests when no game is running", () => {
      const { game, player } = setup();
      game.started = false;

      expect(() => game.requestNewHand(player.id)).toThrow("Game has not started");
    });

    it("keeps the hand and the allowance when the round rejects the sit-out", () => {
      const { game, player } = setup();
      (game._currentRound!.assertCanSitOut as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Card czar cannot sit out");
      });

      expect(() => game.requestNewHand(player.id)).toThrow("Card czar cannot sit out");
      expect(player.hand.size).toBe(10);
      expect(player.newHandsUsed).toBe(0);
    });

    it("does not deal cards to players who sat out when the next round starts", () => {
      const { game, player } = setup();
      const czar = makePlayer("czar");
      const other = makePlayer("other");
      [czar, other].forEach((p) => {
        mocks.gameUsers.set(p.id, p);
        mocks.activeUsers.push(p);
      });
      game._currentCzar = czar as never;
      game._blackCards = [{ id: "b", pick: 1, state: CardState.AVAILABLE } as never];
      game._currentRound = {
        blackCard: { pick: 1 },
        cardCzar: czar,
        _sittingOut: new Set([player.id]),
      } as never;
      const before = player.hand.size;

      game.nextRound();

      expect(player.hand.size).toBe(before);
      expect(other.hand.size).toBe(1);
    });
  });
});
