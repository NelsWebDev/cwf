import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const points = new Map<string, number>();
  return {
    activeUsers: [] as unknown[],
    gameUsers: new Map(),
    points,
    game: {
      started: false,
      rules: { pointsToWin: 8, pointsToWinBy: 1 },
      _points: points,
      getPoints: vi.fn((userId: string) => points.get(userId) ?? 0),
      emitJSON: vi.fn(),
      skipBlackCard: vi.fn(),
      endGame: vi.fn(),
      nextRound: vi.fn(),
    },
    publish: vi.fn(),
  };
});

vi.mock("./singletons", () => ({
  game: mocks.game,
  socketManager: {
    get activeUsers() {
      return mocks.activeUsers;
    },
    gameUsers: mocks.gameUsers,
  },
}));

vi.mock("./pubsub", () => ({
  publish: mocks.publish,
}));

import { GameRound } from "./GameRound";
import { CardState, RoundStatus, type BlackCard, type WhiteCard } from "@repo/shared/types";

const makeCard = (
  id: string,
  options: { custom?: boolean; text?: string } = {},
): WhiteCard => ({
  id,
  deckIds: [],
  text: options.text ?? `Answer ${id}`,
  isCustom: options.custom ?? false,
  state: CardState.IN_USE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const makeBlackCard = (): BlackCard => ({
  id: "black-card",
  deckIds: [],
  text: "Prompt _________",
  pick: 1,
  state: CardState.IN_USE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const addUser = (id: string, cards: WhiteCard[] = []) => {
  const user = {
    id,
    isActive: true,
    hand: new Map(cards.map((card) => [card.id, card])),
    addCardsToHand: vi.fn(function (this: { hand: Map<string, WhiteCard> }, returnedCards: WhiteCard[]) {
      returnedCards.forEach((card) => this.hand.set(card.id, card));
    }),
    removeWhiteCardsFromHand: vi.fn(function (
      this: { hand: Map<string, WhiteCard> },
      playedCards: WhiteCard[],
    ) {
      playedCards.forEach((card) => this.hand.delete(card.id));
      return Array.from(this.hand.values());
    }),
  };
  mocks.gameUsers.set(id, user);
  mocks.activeUsers.push(user);
  return user;
};

const makeRound = (czarId = "czar") => {
  const czar = mocks.gameUsers.get(czarId) ?? addUser(czarId);
  return new GameRound(makeBlackCard(), czar as never);
};

describe("GameRound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.activeUsers.length = 0;
    mocks.gameUsers.clear();
    mocks.points.clear();
    mocks.game.started = false;
    mocks.game.rules = { pointsToWin: 8, pointsToWinBy: 1 };
    mocks.game.getPoints.mockClear();
    mocks.game.emitJSON.mockClear();
    mocks.game.skipBlackCard.mockClear();
    mocks.game.endGame.mockClear();
    mocks.game.nextRound.mockClear();
    mocks.publish.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects a submission from an unknown user", () => {
    const round = makeRound();

    expect(() => round.playWhiteCards("missing", [])).toThrow("User not found");
  });

  it("prevents the card czar from submitting cards", () => {
    const czar = addUser("czar");
    const round = new GameRound(makeBlackCard(), czar as never);

    expect(() => round.playWhiteCards(czar.id, [])).toThrow("Card czar cannot play");
  });

  it("rejects card submissions outside the player-submission phase", () => {
    const player = addUser("player", [makeCard("card")]);
    const round = makeRound();
    round.status = RoundStatus.SELECTING_WINNER;

    expect(() => round.playWhiteCards(player.id, [makeCard("card")])).toThrow(
      "Cannot play in this phase",
    );
    expect(player.hand.has("card")).toBe(true);
  });

  it("rejects cards that are not in the player's hand without recording a play", () => {
    const player = addUser("player");
    const round = makeRound();

    expect(() => round.playWhiteCards(player.id, [makeCard("not-owned")])).toThrow(
      "User does not have this card",
    );
    expect(round.plays).toEqual({});
  });

  it("records a play, removes its card from the hand, and censors the play in JSON", () => {
    const player = addUser("player", [makeCard("card")]);
    addUser("other-player", [makeCard("other-card")]);
    const round = makeRound();

    round.playWhiteCards(player.id, [makeCard("card")]);

    expect(round.plays[player.id]?.map((card) => card.id)).toEqual(["card"]);
    expect(player.hand.has("card")).toBe(false);
    expect(round.toJSON().plays).toEqual({ [player.id]: [] });
    expect(mocks.game.emitJSON).toHaveBeenCalledOnce();
  });

  it("uses the submitted text for a custom blank card", () => {
    const customCard = makeCard("custom", { custom: true, text: "" });
    const player = addUser("player", [customCard]);
    const round = makeRound();

    round.playWhiteCards(player.id, [{ ...customCard, text: "my custom answer" }]);

    expect(round.plays[player.id]?.[0]?.text).toBe("my custom answer");
  });

  it("rejects a second submission from the same player", () => {
    const player = addUser("player", [makeCard("first"), makeCard("second")]);
    addUser("other-player");
    const round = makeRound();
    round.playWhiteCards(player.id, [makeCard("first")]);

    expect(() => round.playWhiteCards(player.id, [makeCard("second")])).toThrow(
      "User already played",
    );
    expect(player.hand.has("second")).toBe(true);
  });

  it("reveals plays only after every non-czar player submits", () => {
    const first = addUser("first", [makeCard("first-card")]);
    const second = addUser("second", [makeCard("second-card")]);
    const round = makeRound();

    round.playWhiteCards(first.id, [makeCard("first-card")]);
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
    expect(round.toJSON().plays[first.id]).toEqual([]);

    round.playWhiteCards(second.id, [makeCard("second-card")]);
    expect(round.toJSON().plays[second.id]).toEqual([]);
    vi.advanceTimersByTime(5_000);

    expect(round.status).toBe(RoundStatus.SELECTING_WINNER);
    expect(Object.values(round.toJSON().plays).flat()).toHaveLength(2);
    expect(mocks.game.emitJSON).toHaveBeenCalledTimes(3);
  });

  it("does not reveal plays if a player undoes before the submission timer expires", () => {
    const first = addUser("first", [makeCard("first-card")]);
    const second = addUser("second", [makeCard("second-card")]);
    const round = makeRound();

    round.playWhiteCards(first.id, [makeCard("first-card")]);
    round.playWhiteCards(second.id, [makeCard("second-card")]);
    round.undoPlay(second.id);
    vi.advanceTimersByTime(5_000);

    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
    expect(round.plays).toEqual({ [first.id]: [expect.objectContaining({ id: "first-card" })] });
  });

  it("rejects undo for unknown users, the czar, and later phases", () => {
    const czar = addUser("czar");
    const player = addUser("player");
    const round = new GameRound(makeBlackCard(), czar as never);

    expect(() => round.undoPlay("missing")).toThrow("User not found");
    expect(() => round.undoPlay(czar.id)).toThrow("Card czar cannot play");

    round.status = RoundStatus.SELECTING_WINNER;
    expect(() => round.undoPlay(player.id)).toThrow("Cannot undo play in this phase");
  });

  it("returns played cards to the player's hand and clears custom-card text on undo", () => {
    const customCard = makeCard("custom", { custom: true, text: "" });
    const player = addUser("player", [customCard]);
    const round = makeRound();
    round.playWhiteCards(player.id, [{ ...customCard, text: "temporary answer" }]);

    round.undoPlay(player.id);

    expect(round.plays).toEqual({});
    expect(player.hand.get(customCard.id)?.text).toBe("");
    expect(player.addCardsToHand).toHaveBeenCalledWith([customCard]);
  });

  it("returns harmlessly when asked to return cards for a player with no play", () => {
    const player = addUser("player");
    const round = makeRound();

    expect(() => round.returnPlayersWhiteCards(player.id)).not.toThrow();
    expect(player.addCardsToHand).not.toHaveBeenCalled();
  });

  it("reveals the real plays after the round leaves the waiting phase", () => {
    const player = addUser("player", [makeCard("card")]);
    const round = makeRound();
    round.playWhiteCards(player.id, [makeCard("card")]);
    round.status = RoundStatus.SELECTING_WINNER;

    expect(round.toJSON().plays[player.id]).toEqual([
      expect.objectContaining({ id: "card" }),
    ]);
  });

  it("rejects selecting a card that was not played", () => {
    const round = makeRound();

    expect(() => round.selectWinner("missing-card")).toThrow("Card not found");
  });

  it("requires the winner-selection phase before awarding a played card", () => {
    const player = addUser("player");
    const round = makeRound();
    round._plays.set(player.id, [makeCard("played")]);

    expect(() => round.selectWinner("played")).toThrow(
      "Not in selecting winner phase",
    );
  });

  it("rejects awarding a play to a player who is no longer active", () => {
    const player = addUser("player");
    player.isActive = false;
    const round = makeRound();
    round._plays.set(player.id, [makeCard("played")]);
    round.status = RoundStatus.SELECTING_WINNER;

    expect(() => round.selectWinner("played")).toThrow("User not found");
    expect(mocks.game._points.size).toBe(0);
  });

  it("awards a point, publishes the winner, and advances after the reveal delay", () => {
    const player = addUser("player");
    const round = makeRound();
    round._plays.set(player.id, [makeCard("winning-card")]);
    round.status = RoundStatus.SELECTING_WINNER;
    mocks.points.set(player.id, 2);
    mocks.game.started = true;

    round.selectWinner("winning-card");

    expect(mocks.points.get(player.id)).toBe(3);
    expect(round.winnerId).toBe(player.id);
    expect(round.status).toBe(RoundStatus.SHOWING_WINNER);
    expect(round.blackCard.state).toBe(CardState.PLAYED_PREVIOUSLY);
    expect(mocks.publish).toHaveBeenCalledWith("winnerSelected", player.id);

    vi.advanceTimersByTime(8_000);
    expect(mocks.game.nextRound).toHaveBeenCalledOnce();
    expect(mocks.game.endGame).not.toHaveBeenCalled();
  });

  it("ends the game when the winning score and lead are both reached", () => {
    const player = addUser("player");
    const round = makeRound();
    round._plays.set(player.id, [makeCard("winning-card")]);
    round.status = RoundStatus.SELECTING_WINNER;
    mocks.game.rules = { pointsToWin: 2, pointsToWinBy: 2 };
    mocks.points.set(player.id, 1);
    mocks.game.started = true;

    round.selectWinner("winning-card");
    vi.advanceTimersByTime(8_000);

    expect(mocks.game.endGame).toHaveBeenCalledOnce();
    expect(mocks.game.nextRound).not.toHaveBeenCalled();
  });

  it("does not advance if the game ended during the winner reveal delay", () => {
    const player = addUser("player");
    const round = makeRound();
    round._plays.set(player.id, [makeCard("winning-card")]);
    round.status = RoundStatus.SELECTING_WINNER;
    mocks.game.started = true;

    round.selectWinner("winning-card");
    mocks.game.started = false;
    vi.advanceTimersByTime(8_000);

    expect(mocks.game.endGame).not.toHaveBeenCalled();
    expect(mocks.game.nextRound).not.toHaveBeenCalled();
  });

  it("rejects skip votes outside the submission phase", () => {
    const round = makeRound();
    round.status = RoundStatus.SELECTING_WINNER;

    expect(() => round.voteToSkip("player", true)).toThrow(
      "Cannot vote to skip in this phase",
    );
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });

  it("skips the prompt only when votes exceed half of the non-czar players", () => {
    const voters = [addUser("one"), addUser("two"), addUser("three")];
    const round = makeRound();
    round.voteToSkip(voters[0]!.id, true);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
    round.voteToSkip(voters[1]!.id, true);

    expect(mocks.game.skipBlackCard).toHaveBeenCalledOnce();
    expect(mocks.game.emitJSON).toHaveBeenCalledTimes(2);
  });

  it("does not skip when the yes votes are exactly half of eligible players", () => {
    const voters = [addUser("one"), addUser("two"), addUser("three"), addUser("four")];
    const round = makeRound();

    round.voteToSkip(voters[0]!.id, true);
    round.voteToSkip(voters[1]!.id, true);

    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });

  it("lets a player withdraw their skip vote", () => {
    const voters = [addUser("one"), addUser("two"), addUser("three")];
    const round = makeRound();

    round.voteToSkip(voters[0]!.id, true);
    round.voteToSkip(voters[0]!.id, false);
    round.voteToSkip(voters[1]!.id, true);

    expect(round.votesToSkip[voters[0]!.id]).toBe(false);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });

  describe("sitting out", () => {
    it("excludes the player from the round and does not wait for their cards", () => {
      const [one, two, three] = [addUser("one", [makeCard("a")]), addUser("two", [makeCard("b")]), addUser("three")];
      const round = makeRound();

      round.sitOut(three.id);
      round.playWhiteCards(one.id, [makeCard("a")]);
      round.playWhiteCards(two.id, [makeCard("b")]);
      vi.advanceTimersByTime(5_000);

      expect(round.sittingOut).toEqual([three.id]);
      expect(round.status).toBe(RoundStatus.SELECTING_WINNER);
      expect(round.toJSON().sittingOut).toEqual([three.id]);
    });

    it("awards the round to a player who already played once everyone else sits out", () => {
      const [one, two] = [addUser("one", [makeCard("a")]), addUser("two")];
      const round = makeRound();
      addUser("three");
      round.playWhiteCards(one.id, [makeCard("a")]);

      round.sitOut(two.id);
      expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
      round.sitOut("three");
      expect(round.winnerId).toBe(one.id);
    });

    it("automatically awards the round to the only remaining player", () => {
      const one = addUser("one");
      const two = addUser("two");
      const round = makeRound();

      round.sitOut(two.id);

      expect(round.status).toBe(RoundStatus.SHOWING_WINNER);
      expect(round.winnerId).toBe(one.id);
      expect(mocks.points.get(one.id)).toBe(1);
      expect(mocks.publish).toHaveBeenCalledWith("winnerSelected", one.id);
    });

    it("moves on to the next round after an automatic win", () => {
      addUser("one");
      const two = addUser("two");
      mocks.game.started = true;
      const round = makeRound();

      round.sitOut(two.id);
      vi.advanceTimersByTime(8_000);

      expect(mocks.game.nextRound).toHaveBeenCalledOnce();
    });

    it("does not auto-win while two or more players remain", () => {
      addUser("one");
      addUser("two");
      const three = addUser("three");
      const round = makeRound();

      round.sitOut(three.id);

      expect(round.winnerId).toBeUndefined();
      expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
    });

    it("prevents sitting-out players from playing or voting", () => {
      addUser("one");
      addUser("two");
      const three = addUser("three");
      const round = makeRound();
      round.sitOut(three.id);

      expect(() => round.playWhiteCards(three.id, [])).toThrow("sitting out");
      expect(() => round.voteToSkip(three.id, true)).toThrow("sitting out");
    });

    it("drops the sitting-out player's skip vote and ignores them in the threshold", () => {
      const voters = [addUser("one"), addUser("two"), addUser("three"), addUser("four")];
      const round = makeRound();
      round.voteToSkip(voters[3]!.id, true);

      round.sitOut(voters[3]!.id);
      expect(round.votesToSkip[voters[3]!.id]).toBeUndefined();

      round.voteToSkip(voters[0]!.id, true);
      expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
      round.voteToSkip(voters[1]!.id, true);
      expect(mocks.game.skipBlackCard).toHaveBeenCalledOnce();
    });

    it("rejects invalid sit-outs", () => {
      const one = addUser("one", [makeCard("a")]);
      addUser("two");
      addUser("three");
      const round = makeRound();

      expect(() => round.sitOut("missing")).toThrow("User not found");
      expect(() => round.sitOut("czar")).toThrow("Card czar cannot sit out");
      round.playWhiteCards(one.id, [makeCard("a")]);
      expect(() => round.sitOut(one.id)).toThrow("Undo your play");
      round.sitOut("two");
      expect(() => round.sitOut("two")).toThrow("Already sitting out");
      round.status = RoundStatus.SELECTING_WINNER;
      expect(() => round.sitOut("three")).toThrow("Cannot sit out in this phase");
    });
  });
});
