import { prismaClient } from "../singletons";
import { importDeck } from "../utils/cardImporter";

export const reimportCustomDecks = async () => {

    const daysAgo = 1;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 0);


    const outDatedDecks = await prismaClient.deck.findMany({
        select: { importedDeckId: true, name: true },
        where: {
            importedDeckId: {
                not: {
                    startsWith: "CAH-"
                },
            },
            updatedAt: {
                lte: sinceDate,
            }
        }
    });


    console.log(`Found ${outDatedDecks.length} decks to re-import (not updated in the last ${daysAgo} days).`);
    for (const { name, importedDeckId } of outDatedDecks) {
        try {
            console.log(`Re-importing deck: ${name}`);
            // eslint-disable-next-line no-await-in-loop
            await importDeck(importedDeckId);
            console.log(`✅ Re-imported deck ${name} successfully.\n`);
        } catch (error) {
            console.error(`❌ Error re-importing deck ${name} (${importedDeckId}):`, error, "\n");
        }
    }

    // console.log(deckIds);
    // for (const importedDeckId of deckIds) {
    //     // importDeck(deckId).then(() => {
    //     //     console.log(`✅ Re-imported deck ${deckId} successfully.`);
    //     // });
    // }

}

reimportCustomDecks();