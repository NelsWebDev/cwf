import { prismaClient } from "../singletons";

console.log("🔄 Importing CAH decks...")

type CAHUnpacked = {
    white: string[];
    black: { text: string; pick: number }[];
    packs: {
        name: string;
        white: number[];
        black: number[];
        official: boolean;
    }[];
};

const urlToJSON = async <T extends object>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
};

const BATCH_SIZE = 100;

const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );

(async () => {
    try {
        console.log("🔄 Starting deck import...");
        const url =
            "https://raw.githubusercontent.com/crhallberg/json-against-humanity/refs/heads/latest/cah-all-compact.json";
        const decks = await urlToJSON<CAHUnpacked>(url);
        console.log("📥 Deck data fetched successfully.");
        const numberOfPacks = decks.packs.length;
        console.log(
            `📦 Found ${decks.packs.length} packs with ${decks.white.length} white and ${decks.black.length} black cards.`
        );

        const previouslyImportedDecks = await prismaClient.deck.findMany({
            where: {
                importedDeckId: {
                    startsWith: "CAH-",
                },
            },
        });
        if (previouslyImportedDecks.length > 0) {
            console.log(
                `⚠️  This script has already been run before. Deleting existing decks...`
            );
            await prismaClient.deck.deleteMany({
                where: {
                    importedDeckId: {
                        startsWith: "CAH-",
                    },
                },
            });
        }

        console.log("🔄 Importing decks...");
        for (const [deckIndex, pack] of Object.entries(decks.packs)) {
            const whiteCards = decks.white
                .map((text, index) => ({ text, index }))
                .filter(({ index }) => pack.white.includes(index))
                .map(({ text }) => ({ text }));

            const blackCards = decks.black
                .map((card, index) => ({ ...card, index }))
                .filter(({ index }) => pack.black.includes(index))
                .map(({ text, pick }) => ({ text, pick }));

            const { name } = pack;
            const deckNumber = parseInt(deckIndex, 10) + 1;

            console.log(`\n🔄 Creating deck: ${name} (${deckNumber}/${numberOfPacks})`);

            const createdDeck = await prismaClient.deck.create({
                data: { name, importedDeckId: `CAH-${deckIndex}` },
            });

            console.log(`\t✅ Deck created with ID: ${createdDeck.id}`);
            console.log(
                `\t🔄 Importing ${whiteCards.length} white and ${blackCards.length} black cards....`
            );

            // Create white cards in chunks
            for (const whiteChunk of chunkArray(whiteCards, BATCH_SIZE)) {
                await prismaClient.whiteCard.createMany({
                    data: whiteChunk.map((card) => ({
                        ...card,
                        deckId: createdDeck.id,
                    })),
                });
            }

            // Create black cards in chunks
            for (const blackChunk of chunkArray(blackCards, BATCH_SIZE)) {
                await prismaClient.blackCard.createMany({
                    data: blackChunk.map((card) => ({
                        ...card,
                        deckId: createdDeck.id,
                    })),
                });
            }

            console.log(
                `\t✅ Deck imported with ${whiteCards.length} white and ${blackCards.length} black cards.`
            );
        }
    } catch (error) {
        console.error("\t❌ Deck import failed:", error);
    }
})();
