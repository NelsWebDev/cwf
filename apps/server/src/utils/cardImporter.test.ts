import { describe, expect, it, vi } from "vitest";

vi.mock("../singletons", () => ({
  prismaClient: {},
}));

vi.mock("../CardManager", () => ({
  CardManager: {
    deckFromPrismaQuery: vi.fn(),
  },
}));

import { parseDeckToPrismaCreate } from "./cardImporter";

describe("parseDeckToPrismaCreate", () => {
  it("converts calls, response cards, and deck metadata to Prisma create input", () => {
    const result = parseDeckToPrismaCreate({
      error: 0,
      name: "Example deck",
      description: "A description",
      watermark: "ABCDE",
      calls: [{ text: ["I love", "cats"] }, { text: ["Wait", "!"] }],
      responses: [{ text: ["a response"] }],
    });

    expect(result).toEqual({
      name: "Example deck",
      description: "A description",
      importedDeckId: "ABCDE",
      blackCards: {
        create: [
          { blackCard: { create: { text: "I love _________ cats", pick: 1 } } },
          { blackCard: { create: { text: "Wait _________!", pick: 1 } } },
        ],
      },
      whiteCards: {
        create: [{ whiteCard: { create: { text: "a response" } } }],
      },
    });
  });

  it("preserves the pick count for multi-blank calls", () => {
    const result = parseDeckToPrismaCreate({
      error: 0,
      name: "Multi-blank deck",
      description: "",
      watermark: "ABCDE",
      calls: [{ text: ["", "and", "?"] }],
      responses: [],
    });

    expect(result.blackCards.create).toEqual([
      {
        blackCard: {
          create: { text: "_________ and _________?", pick: 2 },
        },
      },
    ]);
  });
});
