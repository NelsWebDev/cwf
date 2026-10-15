import { describe, expect, it } from "vitest";
import { makeEvents, makeWhiteCard } from "../testing/fakes";
import { GameUser } from "./GameUser";

const setup = (profile = { username: "player" }) => {
  const events = makeEvents();
  return { events, user: new GameUser(profile, events) };
};

describe("GameUser", () => {
  it("generates an id unless one is given", () => {
    expect(setup().user.id).toBeTruthy();
    expect(setup({ username: "x", id: "fixed" } as never).user.id).toBe("fixed");
  });

  it("prefers the Discord name for display", () => {
    const { user } = setup();
    expect(user.displayName).toBe("player");
    user.discordName = "disc";
    expect(user.displayName).toBe("disc");
  });

  it("announces the cards it is given", () => {
    const { user, events } = setup();
    const card = makeWhiteCard("a");
    user.addCardsToHand([card]);
    expect(user.hand.get("a")).toBe(card);
    expect(events.cardsDealt).toHaveBeenCalledWith(user.id, [card]);
  });

  it("publishes the complete hand after removing cards", () => {
    const { user, events } = setup();
    const first = makeWhiteCard("first");
    const second = makeWhiteCard("second");
    user.addCardsToHand([first, second]);

    user.removeCardsFromHand([first]);

    expect(events.handReplaced).toHaveBeenCalledWith(user.id, [second]);
  });

  it("replaces and clears the hand", () => {
    const { user } = setup();
    user.addCardsToHand([makeWhiteCard("a")]);
    user.replaceHand([makeWhiteCard("b")]);
    expect([...user.hand.keys()]).toEqual(["b"]);
    user.clearHand();
    expect(user.hand.size).toBe(0);
  });
});
