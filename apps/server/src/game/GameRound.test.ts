import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoundStatus } from "@repo/shared/types";
import { makeBlackCard, makeRoster, makeWhiteCard } from "../testing/fakes";
import { GameRound } from "./GameRound";

const UNDO_WINDOW_MS = 5_000;

const setup = (playerCount = 4, pick = 1) => {
  const { roster, players } = makeRoster(playerCount);
  const [czar, ...others] = players as [(typeof players)[number], ...typeof players];
  others.forEach((player, index) =>
    player.addCardsToHand([makeWhiteCard(`${player.id}-a`), makeWhiteCard(`${player.id}-b`), makeWhiteCard(`${player.id}-c${index}`)]),
  );
  const observer = { roundChanged: vi.fn(), winnerAwarded: vi.fn(), skipRequested: vi.fn() };
  const round = new GameRound(makeBlackCard("b1", { pick }), czar, roster, observer);
  const play = (player: (typeof players)[number], cardId = `${player.id}-a`) =>
    round.playWhiteCards(player, [makeWhiteCard(cardId)]);
  return { round, czar, others, observer, roster, play };
};

describe("GameRound submissions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("prevents the card czar from submitting cards", () => {
    const { round, czar } = setup();
    expect(() => round.playWhiteCards(czar, [])).toThrow("Card czar cannot play");
  });

  it("rejects submissions outside the player-submission phase", () => {
    const { round, others, play } = setup(2);
    play(others[0]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(round.status).toBe(RoundStatus.SELECTING_WINNER);
    expect(() => round.playWhiteCards(others[0]!, [])).toThrow("Cannot play in this phase");
  });

  it("rejects cards that are not in the player's hand without recording a play", () => {
    const { round, others } = setup();
    expect(() => round.playWhiteCards(others[0]!, [makeWhiteCard("nope")])).toThrow(
      "User does not have this card",
    );
    expect(round.plays).toEqual({});
  });

  it("records a play, removes its card from the hand, and hides it in JSON", () => {
    const { round, others, play } = setup();
    play(others[0]!);

    expect(others[0]!.hand.has("p2-a")).toBe(false);
    expect(round.plays["p2"]).toHaveLength(1);
    expect(round.toJSON().plays).toEqual({ p2: [] });
  });

  it("uses the submitted text for a custom blank card", () => {
    const { round, others } = setup();
    const custom = makeWhiteCard("custom", { isCustom: true, text: "" });
    others[0]!.addCardsToHand([custom]);

    round.playWhiteCards(others[0]!, [{ ...custom, text: "my joke" }]);

    expect(round.plays["p2"]![0]!.text).toBe("my joke");
  });

  it("rejects a second submission from the same player", () => {
    const { round, others, play } = setup();
    play(others[0]!);
    expect(() => round.playWhiteCards(others[0]!, [makeWhiteCard("p2-b")])).toThrow(
      "User already played",
    );
  });

  it("reveals plays only after every non-czar player submits and the undo window passes", () => {
    const { round, others, play, observer } = setup(3);
    play(others[0]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);

    play(others[1]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
    vi.advanceTimersByTime(1);
    expect(round.status).toBe(RoundStatus.SELECTING_WINNER);
    expect(round.toJSON().plays["p2"]).toHaveLength(1);
    expect(observer.roundChanged).toHaveBeenCalled();
  });

  it("does not reveal if a player undoes before the window expires", () => {
    const { round, others, play } = setup(2);
    play(others[0]!);
    round.undoPlay(others[0]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
  });

  it("returns cards on undo and clears custom-card text", () => {
    const { round, others } = setup();
    const custom = makeWhiteCard("custom", { isCustom: true, text: "" });
    others[0]!.addCardsToHand([custom]);
    round.playWhiteCards(others[0]!, [{ ...custom, text: "joke" }]);

    round.undoPlay(others[0]!);

    expect(others[0]!.hand.get("custom")!.text).toBe("");
    expect(round.plays).toEqual({});
  });

  it("rejects undo from the czar and outside the submission phase", () => {
    const { round, czar, others, play } = setup(2);
    expect(() => round.undoPlay(czar)).toThrow("Card czar cannot play");
    play(others[0]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(() => round.undoPlay(others[0]!)).toThrow("Cannot undo play in this phase");
  });

  it("returnAllPlays gives every submission back to its player", () => {
    const { round, others, play } = setup();
    play(others[0]!);
    round.returnAllPlays();
    expect(others[0]!.hand.has("p2-a")).toBe(true);
    expect(round.plays).toEqual({});
  });

  it("dispose cancels a pending reveal", () => {
    const { round, others, play } = setup(2);
    play(others[0]!);
    round.dispose();
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
  });
});

describe("GameRound winner selection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const selecting = () => {
    const ctx = setup(3);
    ctx.play(ctx.others[0]!);
    ctx.play(ctx.others[1]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    return ctx;
  };

  it("rejects selecting a card that was not played", () => {
    const { round } = selecting();
    expect(() => round.selectWinner("unknown")).toThrow("Card not found");
  });

  it("requires the winner-selection phase", () => {
    const { round, others, play } = setup(3);
    play(others[0]!);
    expect(() => round.selectWinner("p2-a")).toThrow("Not in selecting winner phase");
  });

  it("rejects awarding a play to a player who is no longer active", () => {
    const { round, others } = selecting();
    others[0]!.isActive = false;
    expect(() => round.selectWinner("p2-a")).toThrow("User not found");
  });

  it("marks the winner and notifies the observer", () => {
    const { round, observer } = selecting();
    round.selectWinner("p3-a");
    expect(round.status).toBe(RoundStatus.SHOWING_WINNER);
    expect(round.winnerId).toBe("p3");
    expect(observer.winnerAwarded).toHaveBeenCalledWith("p3");
  });
});

describe("GameRound skip votes", () => {
  it("rejects votes from the czar", () => {
    const { round, czar } = setup();
    expect(() => round.voteToSkip(czar, true)).toThrow("Card czar cannot vote to skip");
  });

  it("requests a skip only when yes votes exceed half of the non-czar players", () => {
    const { round, others, observer } = setup(5);
    round.voteToSkip(others[0]!, true);
    round.voteToSkip(others[1]!, true);
    expect(observer.skipRequested).not.toHaveBeenCalled();
    round.voteToSkip(others[2]!, true);
    expect(observer.skipRequested).toHaveBeenCalledOnce();
  });

  it("lets a player withdraw their vote", () => {
    const { round, others, observer } = setup(3);
    round.voteToSkip(others[0]!, true);
    observer.skipRequested.mockClear();
    round.voteToSkip(others[0]!, false);
    round.voteToSkip(others[1]!, true);
    expect(observer.skipRequested).not.toHaveBeenCalled();
    expect(round.votesToSkip).toEqual({ p2: false, p3: true });
  });
});

describe("GameRound sitting out", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops waiting for the player's cards", () => {
    const { round, others, play } = setup(4);
    round.sitOut(others[0]!);
    play(others[1]!);
    play(others[2]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(round.status).toBe(RoundStatus.SELECTING_WINNER);
    expect(round.sittingOut).toEqual(["p2"]);
  });

  it("awards the round to the only remaining player", () => {
    const { round, others, observer } = setup(3);
    round.sitOut(others[0]!);
    expect(round.winnerId).toBe("p3");
    expect(observer.winnerAwarded).toHaveBeenCalledWith("p3");
  });

  it("does not auto-win while two or more players remain", () => {
    const { round, others, observer } = setup(4);
    round.sitOut(others[0]!);
    expect(observer.winnerAwarded).not.toHaveBeenCalled();
    expect(round.status).toBe(RoundStatus.WAITING_FOR_PLAYERS);
  });

  it("prevents sitting-out players from playing or voting", () => {
    const { round, others, play } = setup(4);
    round.sitOut(others[0]!);
    expect(() => play(others[0]!)).toThrow("You are sitting out this round");
    expect(() => round.voteToSkip(others[0]!, true)).toThrow("You are sitting out this round");
  });

  it("drops the player's skip vote", () => {
    const { round, others } = setup(4);
    round.voteToSkip(others[0]!, true);
    round.sitOut(others[0]!);
    expect(round.votesToSkip).toEqual({});
  });

  it("rejects invalid sit-outs", () => {
    const { round, czar, others, play } = setup(4);
    expect(() => round.sitOut(czar)).toThrow("Card czar cannot sit out");
    round.sitOut(others[0]!);
    expect(() => round.sitOut(others[0]!)).toThrow("Already sitting out");
    play(others[1]!);
    expect(() => round.sitOut(others[1]!)).toThrow("Undo your play before sitting out");
  });
});

describe("GameRound phase guards", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const inSelectingPhase = () => {
    const ctx = setup(3);
    ctx.play(ctx.others[0]!);
    ctx.play(ctx.others[1]!);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    return ctx;
  };

  it("rejects skip votes once plays are revealed", () => {
    const { round, others } = inSelectingPhase();
    expect(() => round.voteToSkip(others[0]!, true)).toThrow("Cannot vote to skip in this phase");
  });

  it("rejects sitting out once plays are revealed", () => {
    const { round, others } = inSelectingPhase();
    expect(() => round.assertCanSitOut(others[0]!)).toThrow("Cannot sit out in this phase");
  });
});
