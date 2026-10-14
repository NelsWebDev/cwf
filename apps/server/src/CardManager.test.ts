import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaClient: { deck: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("./singletons", () => ({ prismaClient: mocks.prismaClient }));

import { CardManager, liveCardCounts } from "./CardManager";

const db = mocks.prismaClient;
const countedDeck = { id: "d", name: "n", description: null, importedDeckId: null, _count: { blackCards: 1, whiteCards: 2 } };

beforeEach(() => vi.resetAllMocks());

describe("CardManager soft deletes", () => {
  it("fetchAllDecks skips deleted decks and counts only live cards", async () => {
    db.deck.findMany.mockResolvedValue([countedDeck]);
    const decks = await CardManager.fetchAllDecks();
    expect(db.deck.findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, include: { _count: liveCardCounts } });
    expect(decks[0]).toMatchObject({ numberOfBlackCards: 1, numberOfWhiteCards: 2 });
  });

  it("fetchDeck always excludes deleted decks", async () => {
    db.deck.findFirst.mockResolvedValue(null);
    expect(await CardManager.fetchDeck({ id: "d" })).toBeNull();
    expect(db.deck.findFirst.mock.calls[0]![0].where).toEqual({ id: "d", deletedAt: null });
  });

  it("deckExists is false for soft-deleted decks", async () => {
    db.deck.findUnique.mockResolvedValue({ id: "d", deletedAt: new Date() });
    expect(await CardManager.deckExists("d")).toBe(false);
    db.deck.findUnique.mockResolvedValue({ id: "d", deletedAt: null });
    expect(await CardManager.deckExists("d")).toBe(true);
    db.deck.findUnique.mockResolvedValue(null);
    expect(await CardManager.deckExists("d")).toBe(false);
  });
});
