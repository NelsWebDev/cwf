import { describe, expect, it } from "vitest";
import { CardState } from "@repo/shared/types";
import { makeBlackCards, makeWhiteCards } from "../testing/fakes";
import { BlackCardPile, WhiteCardPile, makeBlankWhiteCards } from "./CardPiles";

describe("makeBlankWhiteCards", () => {
  it("creates empty custom cards with unique ids", () => {
    const cards = makeBlankWhiteCards(3);
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(cards.every((c) => c.isCustom && c.text === "")).toBe(true);
  });
});

describe("BlackCardPile", () => {
  it("draws each card once and marks it in use", () => {
    const pile = new BlackCardPile(makeBlackCards(3));
    const drawn = [pile.draw(), pile.draw(), pile.draw()];
    expect(new Set(drawn.map((c) => c.id)).size).toBe(3);
    expect(drawn.every((c) => c.state === CardState.IN_USE)).toBe(true);
  });

  it("reshuffles used cards when exhausted, but never the one on the table", () => {
    const pile = new BlackCardPile(makeBlackCards(3));
    const first = pile.draw();
    pile.draw().state = CardState.PLAYED_PREVIOUSLY;
    pile.draw().state = CardState.SKIPPED;

    const next = pile.draw();
    expect(next.id).not.toBe(first.id);
  });

  it("throws instead of looping when nothing can be drawn", () => {
    expect(() => new BlackCardPile().draw()).toThrow("No black cards left");
    const pile = new BlackCardPile(makeBlackCards(1));
    pile.draw();
    expect(() => pile.draw()).toThrow("No black cards left");
  });
});

describe("WhiteCardPile", () => {
  it("assembles a pile of the requested size with custom cards mixed in", () => {
    const pile = WhiteCardPile.assemble(makeWhiteCards(20), { size: 10, customCards: 3 });
    const top = pile.draw(10);
    expect(top.filter((c) => c.isCustom)).toHaveLength(3);
    expect(pile.size).toBe(23);
  });

  it("fails when there are not enough cards", () => {
    expect(() => WhiteCardPile.assemble(makeWhiteCards(5), { size: 10, customCards: 0 })).toThrow(
      "Need 10 white cards but only got 5",
    );
  });

  it("draws available cards and marks them in use", () => {
    const pile = new WhiteCardPile(makeWhiteCards(5));
    const drawn = pile.draw(2);
    expect(drawn).toHaveLength(2);
    expect(drawn.every((c) => c.state === CardState.IN_USE)).toBe(true);
    expect(pile.available).toHaveLength(3);
  });

  it("tops up from recycled cards when it runs dry", () => {
    const cards = makeWhiteCards(4);
    const pile = new WhiteCardPile(cards);
    pile.draw(2);
    cards[0]!.state = CardState.PLAYED_PREVIOUSLY;
    cards[1]!.state = CardState.PLAYED_PREVIOUSLY;

    expect(pile.draw(4)).toHaveLength(4);
  });

  it("never recycles custom cards", () => {
    const cards = makeWhiteCards(1);
    cards[0]!.isCustom = true;
    cards[0]!.state = CardState.PLAYED_PREVIOUSLY;
    const pile = new WhiteCardPile(cards);
    expect(() => pile.draw(1)).toThrow("Not enough cards");
  });

  it("takes nothing when it cannot satisfy the whole request", () => {
    const pile = new WhiteCardPile(makeWhiteCards(2));
    expect(() => pile.draw(3)).toThrow("Not enough cards");
    expect(pile.available).toHaveLength(2);
  });
});
