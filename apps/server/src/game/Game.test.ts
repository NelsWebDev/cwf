import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, DEFAULT_RULES, RoundStatus } from "@repo/shared/types";
import {
  makeBlackCards,
  makeCardSource,
  makeRoster,
  makeWhiteCard,
  makeWhiteCards,
} from "../testing/fakes";
import { Game, HAND_SIZE } from "./Game";

const UNDO_WINDOW_MS = 5_000;
const WINNER_DISPLAY_MS = 8_000;

const setup = (playerCount = 3, cardSource = makeCardSource()) => {
  const { roster, players, events } = makeRoster(playerCount);
  const game = new Game({ roster, events, cards: cardSource });
  return { game, roster, players, events, cardSource };
};

const startedGame = async (playerCount = 3) => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const ctx = setup(playerCount);
  await ctx.game.start();
  const round = ctx.game.currentRound!;
  const czar = ctx.players.find((p) => p.id === round.cardCzarId)!;
  const others = ctx.players.filter((p) => p !== czar);
  return { ...ctx, round, czar, others };
};

describe("Game settings", () => {
  it("updates only the supplied rules and broadcasts the result", () => {
    const { game, events } = setup();
    game.updateRules({ pointsToWin: 12 });
    expect(game.rules).toEqual({ ...DEFAULT_RULES, pointsToWin: 12 });
    expect(events.rulesChanged).toHaveBeenCalledWith(game.rules);
  });

  it("adds a deck once and broadcasts the configured decks", async () => {
    const { game, events, cardSource } = setup();
    await game.addDeck("deck-1");
    await game.addDeck("deck-1");
    expect(cardSource.fetchDeck).toHaveBeenCalledOnce();
    expect(game.decks.map((d) => d.id)).toEqual(["deck-1"]);
    expect(events.decksChanged).toHaveBeenCalledOnce();
  });

  it("rejects adding a deck that does not exist", async () => {
    const { game, cardSource } = setup();
    cardSource.fetchDeck.mockResolvedValue(null as never);
    await expect(game.addDeck("missing")).rejects.toThrow("Deck not found");
  });

  it("removes a configured deck and ignores unknown ones", async () => {
    const { game, events } = setup();
    await game.addDeck("deck-1");
    events.decksChanged.mockClear();

    game.removeDeck("other");
    expect(events.decksChanged).not.toHaveBeenCalled();
    game.removeDeck("deck-1");
    expect(game.decks).toEqual([]);
    expect(events.decksChanged).toHaveBeenCalledOnce();
  });

  it("does not allow settings changes once the game has started", async () => {
    const { game } = await startedGame();
    expect(() => game.updateRules({ pointsToWin: 12 })).toThrow("Game already started");
    expect(() => game.removeDeck("deck-1")).toThrow("Game already started");
    await expect(game.addDeck("deck-2")).rejects.toThrow("Game already started");
  });
});

describe("Game.start", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires at least three active players", async () => {
    const { game, cardSource } = setup(2);
    await expect(game.start()).rejects.toThrow("Not enough players");
    expect(cardSource.fetchCards).not.toHaveBeenCalled();
  });

  it("prevents starting twice, including concurrently", async () => {
    const { game } = setup();
    const first = game.start();
    await expect(game.start()).rejects.toThrow("Game has already started");
    await first;
    await expect(game.start()).rejects.toThrow("Game has already started");
  });

  it("requires enough black cards for the configured winning score", async () => {
    const { game } = setup(3, makeCardSource({ blackCards: makeBlackCards(5) }));
    await expect(game.start()).rejects.toThrow("Not enough black cards");
    expect(game.started).toBe(false);
  });

  it("requires enough white cards for hands and future rounds", async () => {
    const { game, players } = setup(3, makeCardSource({ whiteCards: makeWhiteCards(20) }));
    await expect(game.start()).rejects.toThrow(/Need \d+ white cards but only got 20/);
    expect(game.started).toBe(false);
    expect(players[0]!.hand.size).toBe(0);
  });

  it("deals a full hand to every player and opens the first round", async () => {
    const { players, game, events, round, czar } = await startedGame();
    expect(game.started).toBe(true);
    players.forEach((p) => expect(p.hand.size).toBe(HAND_SIZE));
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
    expect(czar.id).toBe(players[0]!.id);
    expect(game.currentCardCzar).toBe(czar);
    expect(events.gameChanged).toHaveBeenCalled();
  });

  it("only asks for single-answer prompts when multi-answer cards are disabled", async () => {
    const { game, cardSource } = setup();
    game.updateRules({ allowMultipleAnswerBlackCards: false });
    await game.start();
    expect(cardSource.fetchCards).toHaveBeenCalledWith(
      expect.objectContaining({ singleAnswerOnly: true }),
    );
  });

  it("mixes custom blank cards into the dealt cards", async () => {
    const { game, players } = setup();
    game.updateRules({ numberOfCustomCards: 5 });
    await game.start();
    const dealt = players.flatMap((p) => [...p.hand.values()]);
    expect(dealt.filter((card) => card.isCustom).length).toBeGreaterThan(0);
  });
});

describe("Game rounds", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const playAll = (ctx: Awaited<ReturnType<typeof startedGame>>) => {
    ctx.others.forEach((p) => {
      const card = [...p.hand.values()][0]!;
      ctx.game.playCards(p, [card]);
    });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
  };

  it("rejects player actions when no game is running", () => {
    const { game, players } = setup();
    expect(() => game.playCards(players[0]!, [])).toThrow("Game has not started");
    expect(() => game.pickWinner(players[0]!, "x")).toThrow("Game has not started");
  });

  it("only lets the czar pick the winner", async () => {
    const ctx = await startedGame();
    playAll(ctx);
    const card = ctx.round.plays[ctx.others[0]!.id]![0]!;
    expect(() => ctx.game.pickWinner(ctx.others[0]!, card.id)).toThrow("You are not the card czar");
  });

  it("awards a point, announces the winner and moves to the next round after the display delay", async () => {
    const ctx = await startedGame();
    playAll(ctx);
    const winner = ctx.others[0]!;
    const card = ctx.round.plays[winner.id]![0]!;

    ctx.game.pickWinner(ctx.czar, card.id);

    expect(ctx.game.pointsOf(winner.id)).toBe(1);
    expect(ctx.events.winnerSelected).toHaveBeenCalledWith(winner.id);
    expect(ctx.game.currentRound).toBe(ctx.round);

    vi.advanceTimersByTime(WINNER_DISPLAY_MS);

    expect(ctx.game.currentRound).not.toBe(ctx.round);
    expect(ctx.game.currentCardCzar!.id).not.toBe(ctx.czar.id);
    ctx.others.forEach((p) => expect(p.hand.size).toBe(HAND_SIZE));
  });

  it("ends the game when the winning score and lead are reached", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { game, players, events } = setup();
    game.updateRules({ pointsToWin: 1 });
    await game.start();
    const round = game.currentRound!;
    const czar = players.find((p) => p.id === round.cardCzarId)!;
    const others = players.filter((p) => p !== czar);
    others.forEach((p) => game.playCards(p, [[...p.hand.values()][0]!]));
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    const winner = others[0]!;

    game.pickWinner(czar, round.plays[winner.id]![0]!.id);
    vi.advanceTimersByTime(WINNER_DISPLAY_MS);

    expect(events.gameEnded).toHaveBeenCalledWith(winner.username);
    expect(game.started).toBe(false);
  });

  it("does not advance a stale round after the game was ended", async () => {
    const ctx = await startedGame();
    playAll(ctx);
    ctx.game.pickWinner(ctx.czar, ctx.round.plays[ctx.others[0]!.id]![0]!.id);
    ctx.game.endGame();
    vi.advanceTimersByTime(WINNER_DISPLAY_MS);
    expect(ctx.game.currentRound).toBeUndefined();
  });

  it("rotates the czar between rounds", async () => {
    const ctx = await startedGame();
    playAll(ctx);
    ctx.game.pickWinner(ctx.czar, ctx.round.plays[ctx.others[0]!.id]![0]!.id);
    vi.advanceTimersByTime(WINNER_DISPLAY_MS);
    expect(ctx.game.currentCardCzar).toBe(ctx.players[1]);
  });

  it("skipping keeps the czar by default and returns the plays", async () => {
    const ctx = await startedGame();
    const player = ctx.others[0]!;
    const card = [...player.hand.values()][0]!;
    ctx.game.playCards(player, [card]);

    ctx.game.skipBlackCard();

    expect(ctx.round.blackCard.state).toBe(CardState.SKIPPED);
    expect(ctx.game.currentRound).not.toBe(ctx.round);
    expect(ctx.game.currentCardCzar).toBe(ctx.czar);
    expect(player.hand.has(card.id)).toBe(true);
  });

  it("moves to a new czar when skipping with replaceCzar", async () => {
    const ctx = await startedGame();
    ctx.game.skipBlackCard({ replaceCzar: true });
    expect(ctx.game.currentCardCzar).toBe(ctx.players[1]);
  });

  it("only lets the czar skip the black card", async () => {
    const ctx = await startedGame();
    expect(() => ctx.game.skipBlackCardAsCzar(ctx.others[0]!)).toThrow("You are not the card czar");
    ctx.game.skipBlackCardAsCzar(ctx.czar);
    expect(ctx.game.currentRound).not.toBe(ctx.round);
  });

  it("skips the black card when enough players vote for it", async () => {
    const ctx = await startedGame();
    ctx.others.forEach((p) => ctx.game.voteToSkip(p, true));
    expect(ctx.game.currentRound).not.toBe(ctx.round);
  });

  it("clears cards, scores, hands and the round when the game ends", async () => {
    const ctx = await startedGame();
    ctx.game.endGame();

    expect(ctx.game.started).toBe(false);
    expect(ctx.game.currentCardCzar).toBeUndefined();
    ctx.players.forEach((p) => expect(p.hand.size).toBe(0));
    expect(ctx.events.gameEnded).toHaveBeenCalledWith("");
    expect(ctx.game.toJSON().currentRound).toBeUndefined();
  });

  it("can start a fresh game after one ended", async () => {
    const ctx = await startedGame();
    ctx.game.endGame();
    await ctx.game.start();
    expect(ctx.game.started).toBe(true);
  });

  it("deals a hand to someone who joins a running game", async () => {
    const ctx = await startedGame();
    const { GameUser } = await import("../session/GameUser");
    const late = new GameUser({ username: "late" }, ctx.events);
    ctx.game.dealHandTo(late);
    expect(late.hand.size).toBe(HAND_SIZE);
  });

  it("does not deal to anyone when no game is running", () => {
    const { game, players } = setup();
    game.dealHandTo(players[0]!);
    expect(players[0]!.hand.size).toBe(0);
  });

  it("describes players with points, czar flag and remaining new hands", async () => {
    const ctx = await startedGame();
    expect(ctx.game.describePlayer(ctx.czar)).toMatchObject({
      id: ctx.czar.id,
      points: 0,
      isCardCzar: true,
      newHandsRemaining: 0,
      discordName: null,
    });
  });
});

describe("Game.requestNewHand", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const withNewHands = async (playerCount = 5) => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = setup(playerCount);
    ctx.game.updateRules({ newHandsPerGame: 2 });
    await ctx.game.start();
    const czarId = ctx.game.currentRound!.cardCzarId;
    return { ...ctx, others: ctx.players.filter((p) => p.id !== czarId) };
  };

  it("is disabled by default", async () => {
    const ctx = await startedGame(4);
    expect(() => ctx.game.requestNewHand(ctx.others[0]!)).toThrow("No new hands remaining");
  });

  it("rejects requests when no game is running", () => {
    const { game, players } = setup();
    expect(() => game.requestNewHand(players[0]!)).toThrow("Game has not started");
  });

  it("replaces the whole hand and sits the player out", async () => {
    const { game, others } = await withNewHands();
    const player = others[0]!;
    const before = new Set(player.hand.keys());

    game.requestNewHand(player);

    expect(player.hand.size).toBe(HAND_SIZE);
    expect([...player.hand.keys()].some((id) => before.has(id))).toBe(false);
    expect(game.currentRound!.sittingOut).toContain(player.id);
    expect(game.newHandsRemaining(player)).toBe(1);
  });

  it("allows only the configured number of new hands per game", async () => {
    const { game, others } = await withNewHands();
    const player = others[0]!;
    game.requestNewHand(player);
    game.skipBlackCard();
    game.requestNewHand(player);
    game.skipBlackCard();
    expect(() => game.requestNewHand(player)).toThrow("No new hands remaining");
  });

  it("keeps the hand and the allowance when the round rejects the sit-out", async () => {
    const { game, players } = await withNewHands();
    const czar = game.currentCardCzar!;
    const before = [...czar.hand.keys()];

    expect(() => game.requestNewHand(czar)).toThrow("Card czar cannot sit out");
    expect([...czar.hand.keys()]).toEqual(before);
    expect(game.newHandsRemaining(czar)).toBe(2);
    expect(players).toContain(czar);
  });

  it("does not deal replacement cards to players who sat out", async () => {
    const { game, others } = await withNewHands();
    const sitter = others[0]!;
    game.requestNewHand(sitter);
    const hand = [...sitter.hand.keys()];
    others.slice(1).forEach((p) => game.playCards(p, [[...p.hand.values()][0]!]));
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    const round = game.currentRound!;
    game.pickWinner(game.currentCardCzar!, Object.values(round.plays)[0]![0]!.id);
    vi.advanceTimersByTime(WINNER_DISPLAY_MS);

    expect([...sitter.hand.keys()]).toEqual(hand);
  });
});

describe("Game white card supply", () => {
  it("keeps game state untouched when starting fails", async () => {
    const { game } = setup(3, makeCardSource({ whiteCards: [makeWhiteCard("only")] }));
    await expect(game.start()).rejects.toThrow();
    expect(game.currentRound).toBeUndefined();
  });
});

describe("Game.undoPlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the played card to the player's hand", async () => {
    const { game, others } = await startedGame();
    const player = others[0]!;
    const card = [...player.hand.values()][0]!;
    game.playCards(player, [card]);
    expect(player.hand.has(card.id)).toBe(false);

    game.undoPlay(player);

    expect(player.hand.has(card.id)).toBe(true);
  });

  it("rejects undo when no game is running", () => {
    const { game, players } = setup();
    expect(() => game.undoPlay(players[0]!)).toThrow("Game has not started");
    expect(() => game.voteToSkip(players[0]!, true)).toThrow("Game has not started");
  });
});
