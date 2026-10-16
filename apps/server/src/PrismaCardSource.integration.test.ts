import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CardState } from "@repo/shared/types";
import { PrismaCardSource } from "./PrismaCardSource";
import { PrismaClient } from "./prisma/generated/client";
import { getTestDatabaseUrl } from "./testing/integrationDatabase";

describe("PrismaCardSource with PostgreSQL", () => {
  const suffix = randomUUID();
  const testDatabaseUrl = getTestDatabaseUrl();
  let prisma: PrismaClient;
  let source: PrismaCardSource;
  let deckId: string | undefined;
  let otherDeckId: string | undefined;
  const deckIds: string[] = [];
  const blackCardIds: string[] = [];
  const whiteCardIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg(testDatabaseUrl) });
    source = new PrismaCardSource(prisma);

    const deck = await prisma.deck.create({ data: { name: `integration-${suffix}` } });
    deckId = deck.id;
    deckIds.push(deck.id);
    const otherDeck = await prisma.deck.create({ data: { name: `integration-other-${suffix}` } });
    otherDeckId = otherDeck.id;
    deckIds.push(otherDeck.id);
    if (!deckId || !otherDeckId) throw new Error("Test decks were not created.");

    const blackCards = await Promise.all([
      prisma.blackCard.create({ data: { text: `single-${suffix}`, pick: 1 } }),
      prisma.blackCard.create({ data: { text: `multiple-${suffix}`, pick: 2 } }),
      prisma.blackCard.create({ data: { text: `deleted-${suffix}`, pick: 1, deletedAt: new Date() } }),
      prisma.blackCard.create({ data: { text: `other-deck-${suffix}`, pick: 1 } }),
    ]);
    blackCardIds.push(...blackCards.map(({ id }) => id));
    await prisma.deckBlackCard.createMany({
      data: [
        { deckId, blackCardId: blackCards[0]!.id },
        { deckId, blackCardId: blackCards[1]!.id },
        { deckId, blackCardId: blackCards[2]!.id },
        { deckId: otherDeckId, blackCardId: blackCards[3]!.id },
      ],
    });

    const whiteCards = await Promise.all([
      prisma.whiteCard.create({ data: { text: `live-${suffix}` } }),
      prisma.whiteCard.create({ data: { text: `deleted-${suffix}`, deletedAt: new Date() } }),
      prisma.whiteCard.create({ data: { text: `other-deck-${suffix}` } }),
    ]);
    whiteCardIds.push(...whiteCards.map(({ id }) => id));
    await prisma.deckWhiteCard.createMany({
      data: [
        { deckId, whiteCardId: whiteCards[0]!.id },
        { deckId, whiteCardId: whiteCards[1]!.id },
        { deckId: otherDeckId, whiteCardId: whiteCards[2]!.id },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      if (deckIds.length) {
        await prisma.$transaction([
          prisma.deckBlackCard.deleteMany({ where: { deckId: { in: deckIds } } }),
          prisma.deckWhiteCard.deleteMany({ where: { deckId: { in: deckIds } } }),
          prisma.blackCard.deleteMany({ where: { id: { in: blackCardIds } } }),
          prisma.whiteCard.deleteMany({ where: { id: { in: whiteCardIds } } }),
          prisma.deck.deleteMany({ where: { id: { in: deckIds } } }),
        ]);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("loads related live cards and excludes soft-deleted and unrelated cards", async () => {
    if (!deckId) throw new Error("Test deck was not created.");
    const { blackCards, whiteCards } = await source.fetchCards({
      deckIds: [deckId],
      singleAnswerOnly: false,
    });

    expect(blackCards.map(({ id }) => id).sort()).toEqual(blackCardIds.slice(0, 2).sort());
    expect(whiteCards.map(({ id }) => id)).toEqual([whiteCardIds[0]]);
    expect(blackCards.every(({ state }) => state === CardState.AVAILABLE)).toBe(true);
    expect(whiteCards[0]).toMatchObject({
      deckIds: [deckId],
      isCustom: false,
      state: CardState.AVAILABLE,
    });
  });

  it("filters prompts by answer count in PostgreSQL", async () => {
    if (!deckId) throw new Error("Test deck was not created.");
    const { blackCards } = await source.fetchCards({ deckIds: [deckId], singleAnswerOnly: true });

    expect(blackCards.map(({ id }) => id)).toEqual([blackCardIds[0]]);
    expect(blackCards[0]?.pick).toBe(1);
  });
});
