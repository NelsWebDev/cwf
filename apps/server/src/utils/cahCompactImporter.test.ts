import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { chunkArray, importCahCompact, type CAHCompact } from "./cahCompactImporter";

const makePrisma = (existingImportedIds: string[] = []) => {
    let cardCounter = 0;
    let deckCounter = 0;
    const createManyAndReturn = () =>
        vi.fn(async ({ data }: { data: unknown[] }) => data.map(() => ({ id: `card-${cardCounter++}` })));
    return {
        deck: {
            findMany: vi.fn(async (_args: unknown) => existingImportedIds.map((importedDeckId) => ({ importedDeckId }))),
            create: vi.fn(async (_args: { data: unknown }) => ({ id: `deck-${deckCounter++}` })),
            deleteMany: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        whiteCard: { createManyAndReturn: createManyAndReturn(), deleteMany: vi.fn(), updateMany: vi.fn() },
        blackCard: { createManyAndReturn: createManyAndReturn(), deleteMany: vi.fn(), updateMany: vi.fn() },
        deckWhiteCard: { createMany: vi.fn() },
        deckBlackCard: { createMany: vi.fn() },
    };
};

const data: CAHCompact = {
    white: ["w0", "w1", "w2"],
    black: [
        { text: "b0", pick: 1 },
        { text: "b1", pick: 2 },
    ],
    packs: {
        "5": { id: 5, name: "Pack A", official: true, white: [0, 1], black: [0] },
        "9": { id: 9, name: "Pack B", official: true, white: [1, 2, 2], black: [0, 1] },
    },
};

describe("chunkArray", () => {
    it("splits arrays into chunks of the given size", () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunkArray([], 2)).toEqual([]);
    });
});

describe("importCahCompact", () => {
    it("inserts each card exactly once without cahOfficial on cards", async () => {
        const prisma = makePrisma();
        await importCahCompact(prisma as unknown as PrismaClient, data);

        expect(prisma.whiteCard.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(prisma.whiteCard.createManyAndReturn.mock.calls[0][0].data).toEqual([
            { text: "w0" },
            { text: "w1" },
            { text: "w2" },
        ]);
        expect(prisma.blackCard.createManyAndReturn.mock.calls[0][0].data).toEqual([
            { text: "b0", pick: 1 },
            { text: "b1", pick: 2 },
        ]);
    });

    it("creates decks marked cahOfficial with CAH- imported ids", async () => {
        const prisma = makePrisma();
        await importCahCompact(prisma as unknown as PrismaClient, data);

        expect(prisma.deck.create.mock.calls.map((c) => c[0].data)).toEqual([
            { name: "Pack A", importedDeckId: "CAH-5", cahOfficial: true },
            { name: "Pack B", importedDeckId: "CAH-9", cahOfficial: true },
        ]);
    });

    it("links decks to shared cards by index and dedupes repeated indexes", async () => {
        const prisma = makePrisma();
        await importCahCompact(prisma as unknown as PrismaClient, data);

        // white card ids are card-0..2, black card ids continue at card-3..4
        const white = prisma.deckWhiteCard.createMany.mock.calls.map((c) => c[0].data);
        expect(white).toEqual([
            [
                { deckId: "deck-0", whiteCardId: "card-0" },
                { deckId: "deck-0", whiteCardId: "card-1" },
            ],
            [
                { deckId: "deck-1", whiteCardId: "card-1" },
                { deckId: "deck-1", whiteCardId: "card-2" },
            ],
        ]);
        const black = prisma.deckBlackCard.createMany.mock.calls.map((c) => c[0].data);
        expect(black).toEqual([
            [{ deckId: "deck-0", blackCardId: "card-3" }],
            [
                { deckId: "deck-1", blackCardId: "card-3" },
                { deckId: "deck-1", blackCardId: "card-4" },
            ],
        ]);
    });

    it("never deletes or updates anything", async () => {
        const prisma = makePrisma(["CAH-5"]);
        await importCahCompact(prisma as unknown as PrismaClient, data);

        for (const model of [prisma.deck, prisma.whiteCard, prisma.blackCard]) {
            expect(model.deleteMany).not.toHaveBeenCalled();
            expect(model.updateMany).not.toHaveBeenCalled();
        }
        expect(prisma.deck.update).not.toHaveBeenCalled();
    });

    it("skips packs that are already imported and only creates their missing siblings' cards", async () => {
        const prisma = makePrisma(["CAH-5"]);
        await importCahCompact(prisma as unknown as PrismaClient, data);

        expect(prisma.deck.create.mock.calls.map((c) => c[0].data)).toEqual([
            { name: "Pack B", importedDeckId: "CAH-9", cahOfficial: true },
        ]);
        // Pack B needs white [1, 2] and black [0, 1]
        expect(prisma.whiteCard.createManyAndReturn.mock.calls[0][0].data).toEqual([
            { text: "w1" },
            { text: "w2" },
        ]);
        expect(prisma.blackCard.createManyAndReturn.mock.calls[0][0].data).toEqual([
            { text: "b0", pick: 1 },
            { text: "b1", pick: 2 },
        ]);
    });

    it("does nothing when every pack is already imported", async () => {
        const prisma = makePrisma(["CAH-5", "CAH-9"]);
        await importCahCompact(prisma as unknown as PrismaClient, data);

        expect(prisma.deck.create).not.toHaveBeenCalled();
        expect(prisma.whiteCard.createManyAndReturn).not.toHaveBeenCalled();
        expect(prisma.blackCard.createManyAndReturn).not.toHaveBeenCalled();
    });

    it("batches large card lists", async () => {
        const prisma = makePrisma();
        const big: CAHCompact = {
            white: Array.from({ length: 2500 }, (_, i) => `w${i}`),
            black: [],
            packs: { "1": { id: 1, name: "Big", official: true, white: Array.from({ length: 2500 }, (_, i) => i), black: [] } },
        };
        await importCahCompact(prisma as unknown as PrismaClient, big);
        expect(prisma.whiteCard.createManyAndReturn).toHaveBeenCalledTimes(3);
    });
});
