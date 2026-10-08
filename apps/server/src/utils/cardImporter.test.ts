import { describe, expect, it, vi } from "vitest";

vi.mock("../singletons", () => ({
  prismaClient: {},
}));

vi.mock("../CardManager", () => ({
  CardManager: {
    deckFromPrismaQuery: vi.fn(),
  },
}));

import { parseDeck } from "./cardImporter";

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
