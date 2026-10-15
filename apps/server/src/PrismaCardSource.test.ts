import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardState } from "@repo/shared/types";

const mocks = vi.hoisted(() => ({ fetchDeck: vi.fn() }));
vi.mock("./CardManager", () => ({ CardManager: { fetchDeck: mocks.fetchDeck } }));

import { PrismaCardSource } from "./PrismaCardSource";

const row = (id: string, deckIds: string[]) => ({
  id,
  text: id,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  decksCards: deckIds.map((deckId) => ({ deckId })),
});

describe("PrismaCardSource", () => {
  const prisma = {
    blackCard: { findMany: vi.fn() },
    whiteCard: { findMany: vi.fn() },
  };
  const source = new PrismaCardSource(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.blackCard.findMany.mockResolvedValue([{ ...row("b1", ["d1", "d2"]), pick: 2 }]);
    prisma.whiteCard.findMany.mockResolvedValue([row("w1", ["d1"])]);
  });

  it("delegates deck lookups", async () => {
    mocks.fetchDeck.mockResolvedValue({ id: "d1" });
    await expect(source.fetchDeck("d1")).resolves.toEqual({ id: "d1" });
    expect(mocks.fetchDeck).toHaveBeenCalledWith({ id: "d1" });
  });

  it("loads live cards from the chosen decks as available cards", async () => {
    const { blackCards, whiteCards } = await source.fetchCards({ deckIds: ["d1"], singleAnswerOnly: false });

    expect(prisma.blackCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, decksCards: { some: { deckId: { in: ["d1"] } } } },
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(blackCards[0]).toMatchObject({ id: "b1", deckIds: ["d1", "d2"], state: CardState.AVAILABLE });
    expect(blackCards[0]).not.toHaveProperty("decksCards");
    expect(whiteCards[0]).toMatchObject({ id: "w1", deckIds: ["d1"], isCustom: false, state: CardState.AVAILABLE });
  });

  it("restricts black cards to single-answer prompts on request", async () => {
    await source.fetchCards({ deckIds: ["d1"], singleAnswerOnly: true });

    expect(prisma.blackCard.findMany.mock.calls[0]![0].where).toMatchObject({ pick: 1 });
    expect(prisma.whiteCard.findMany.mock.calls[0]![0].where).not.toHaveProperty("pick");
  });
});
