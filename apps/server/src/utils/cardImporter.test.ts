import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaClient: { deck: { findFirst: vi.fn() }, $transaction: vi.fn() },
}));

vi.mock("../singletons", () => ({
  prismaClient: mocks.prismaClient,
}));

vi.mock("../CardManager", () => ({
  CardManager: {
    deckFromPrismaQuery: vi.fn(),
  },
  liveCardCounts: {},
}));

import { importDeck, parseDeck } from "./cardImporter";

describe("importDeck", () => {
  it("soft-deletes the deck it replaces and ignores already deleted copies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ name: "n", description: "", watermark: "ABCDE", calls: [], responses: [] }),
      })),
    );
    mocks.prismaClient.deck.findFirst.mockResolvedValue({ id: "old" });
    const tx = {
      deck: { update: vi.fn(), create: vi.fn().mockResolvedValue({ id: "new" }), findUniqueOrThrow: vi.fn() },
      blackCard: { updateMany: vi.fn(), createManyAndReturn: vi.fn().mockResolvedValue([]) },
      whiteCard: { updateMany: vi.fn(), createManyAndReturn: vi.fn().mockResolvedValue([]) },
      deckBlackCard: { createMany: vi.fn() },
      deckWhiteCard: { createMany: vi.fn() },
    };
    mocks.prismaClient.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    await importDeck("ABCDE");

    expect(mocks.prismaClient.deck.findFirst).toHaveBeenCalledWith({
      where: { importedDeckId: "ABCDE", cahOfficial: false, deletedAt: null },
    });
    const deletedAt = tx.deck.update.mock.calls[0]![0].data.deletedAt;
    expect(tx.deck.update).toHaveBeenCalledWith({ where: { id: "old" }, data: { deletedAt } });
    expect(tx.blackCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt } }));
    expect(tx.whiteCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt } }));
    vi.unstubAllGlobals();
  });
});

describe("parseDeck", () => {
  it("converts calls, response cards, and deck metadata to Prisma create input", () => {
    const result = parseDeck({
      error: 0,
      name: "Example deck",
      description: "A description",
      watermark: "ABCDE",
      calls: [{ text: ["I love", "cats"] }, { text: ["Wait", "!"] }],
      responses: [{ text: ["a response"] }],
    });

    expect(result).toEqual({
      deck: {
        name: "Example deck",
        description: "A description",
        importedDeckId: "ABCDE",
        cahOfficial: false,
      },
      blackCards: [
        { text: "I love _________ cats", pick: 1 },
        { text: "Wait _________!", pick: 1 },
      ],
      whiteCards: [{ text: "a response" }],
    });
  });

  it("preserves the pick count for multi-blank calls", () => {
    const result = parseDeck({
      error: 0,
      name: "Multi-blank deck",
      description: "",
      watermark: "ABCDE",
      calls: [{ text: ["", "and", "?"] }],
      responses: [],
    });

    expect(result.blackCards).toEqual([{ text: "_________ and _________?", pick: 2 }]);
  });
});
