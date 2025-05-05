import { CardManager } from "../CardManager";
import { prismaClient } from "../singletons";

interface OriginalDeck {
    name: string;
    description: string;
    watermark: string;
    calls: { text: string[] }[];
    responses: { text: string[] }[];
}

interface PrismaDeck {
    name: string;
    description: string;
    importedDeckId?: string|null;
    blackCards: {
        create: {
            text: string;
            pick: number;
        }[];
    };
    whiteCards: {
        create: {
            text: string;
        }[];
    };
}

async function fetchAndTransformDeck(deckCode: string): Promise<PrismaDeck & { id: string|undefined }> {

    deckCode = deckCode.trim();

    const id = await CardManager.fetchDeck({ importedDeckId: deckCode }).then(r => r?.id || undefined);




    const url = `https://api.crcast.cc/v1/cc/decks/${deckCode}/all`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch deck: ${response.statusText}`);
    }

    const json: OriginalDeck = await response.json();

    console.log(json);
    if (!json.name || !("description" in json) || !Array.isArray(json.calls) || !Array.isArray(json.responses)) {
        throw new Error('Invalid deck format from URL');
    }

    let skippedBlackCards = 0;

    const blackCards = json.calls
        .map(call => {
            let textSegments: string[] = [];

            call.text.forEach(part => {
                if (part.trim() === '') {
                    // only add blank if the last segment was not a blank
                    if (textSegments.length === 0 || textSegments[textSegments.length - 1] !== '_____') {
                        textSegments.push('_____');
                    }
                } else {
                    textSegments.push(part);
                }
            });

            // skip if all blanks (example: ["", "", ""] → ["_____"])
            if (textSegments.every(seg => seg === '_____')) {
                skippedBlackCards++;
                return null;
            }

            const text = textSegments.join(' ');
            const pick = call.text.filter(part => part.trim() === '').length ?? 1;

            return { text, pick };
        })
        .filter((card): card is { text: string; pick: number } => card !== null);

    const whiteCards = json.responses.map(response => ({
        text: response.text[0],
    }));

    console.log(`✅ Processed deck: "${json.name}"`);
    console.log(`✅ Imported black cards: ${blackCards.length}`);
    console.log(`✅ Imported white cards: ${whiteCards.length}`);
    console.log(`⚠️ Skipped black cards (only blanks): ${skippedBlackCards}`);

    return {
        name: json.name,
        description: json.description,
        blackCards: { create: blackCards },
        whiteCards: { create: whiteCards },
        importedDeckId: deckCode,
        id,
    };
}

export async function importDeck(deckCode: string) {
    try {
        const data = await fetchAndTransformDeck(deckCode);

        if(data.id) {
            await prismaClient.deck.delete({
                where: { id: data.id },
            }).then(() => {
                console.log('⚠️ Deleted existing deck with the same ID');
            })
        }


        const createdDeck = await prismaClient.deck.create({ data }).then(r => r.id);
        const deck = CardManager.fetchDeck({ id: createdDeck });
        console.log('🎉 Deck imported successfully into database!');
        return deck;
    } catch (error) {
        console.error('❌ Error importing deck:', error);
        throw error;
    }
}

