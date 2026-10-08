import type { PrismaClient } from "@prisma/client";

export type CAHCompact = {
    white: string[];
    black: { text: string; pick: number }[];
    packs: Record<
        string,
        { id: number; name: string; official: boolean; white: number[]; black: number[] }
    >;
};

const BATCH_SIZE = 1000;

export const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );

/**
 * Imports the compact (index-based) CAH data. Non-destructive and idempotent:
 * packs already imported (matched by importedDeckId) are skipped, nothing is
 * deleted or updated. Each card needed by the new packs is inserted exactly
 * once and shared between decks through the join tables.
 */
export const importCahCompact = async (
    prisma: PrismaClient,
    data: CAHCompact,
    log: (message: string) => void = () => {}
) => {
    const packs = Object.values(data.packs);
    const importedDeckIdFor = (pack: { id: number }) => `CAH-${pack.id}`;

    const existing = await prisma.deck.findMany({
        where: { importedDeckId: { in: packs.map(importedDeckIdFor) } },
        select: { importedDeckId: true },
    });
    const existingIds = new Set(existing.map((d) => d.importedDeckId));
    const newPacks = packs
        .filter((pack) => !existingIds.has(importedDeckIdFor(pack)))
        .map((pack) => ({
            ...pack,
            white: [...new Set(pack.white)],
            black: [...new Set(pack.black)],
        }));

    log(`⏭️  Skipping ${packs.length - newPacks.length} already imported packs.`);
    if (newPacks.length === 0) {
        log("✅ Nothing to import.");
        return;
    }

    const neededWhite = [...new Set(newPacks.flatMap((p) => p.white))];
    const neededBlack = [...new Set(newPacks.flatMap((p) => p.black))];

    const whiteIds = new Map<number, string>();
    for (const chunk of chunkArray(neededWhite, BATCH_SIZE)) {
        const created = await prisma.whiteCard.createManyAndReturn({
            data: chunk.map((idx) => ({ text: data.white[idx] })),
            select: { id: true },
        });
        chunk.forEach((idx, i) => whiteIds.set(idx, created[i].id));
    }
    log(`✅ Created ${whiteIds.size} white cards`);

    const blackIds = new Map<number, string>();
    for (const chunk of chunkArray(neededBlack, BATCH_SIZE)) {
        const created = await prisma.blackCard.createManyAndReturn({
            data: chunk.map((idx) => ({ text: data.black[idx].text, pick: data.black[idx].pick })),
            select: { id: true },
        });
        chunk.forEach((idx, i) => blackIds.set(idx, created[i].id));
    }
    log(`✅ Created ${blackIds.size} black cards`);

    for (const [i, pack] of newPacks.entries()) {
        const deck = await prisma.deck.create({
            data: { name: pack.name, importedDeckId: importedDeckIdFor(pack), cahOfficial: true },
        });

        for (const chunk of chunkArray(pack.white, BATCH_SIZE)) {
            await prisma.deckWhiteCard.createMany({
                data: chunk.map((idx) => ({ deckId: deck.id, whiteCardId: whiteIds.get(idx)! })),
            });
        }
        for (const chunk of chunkArray(pack.black, BATCH_SIZE)) {
            await prisma.deckBlackCard.createMany({
                data: chunk.map((idx) => ({ deckId: deck.id, blackCardId: blackIds.get(idx)! })),
            });
        }
        log(`✅ (${i + 1}/${newPacks.length}) ${pack.name}: ${pack.white.length} white, ${pack.black.length} black`);
    }
};
