import { createInterface } from "readline";
import { importDeck } from "../utils/cardImporter";

const deckId = process.argv[2];

if (!deckId) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question(
        "Please provide the deck ID to import (or type 'q' to quit): ",
        async (input) => {
            rl.close(); // close readline immediately to avoid lingering prompt

            const answer = input.trim().toUpperCase();
            if (answer === "q" || answer === "exit") {
                console.log("Exiting without importing.");
                process.exit(0);
            }

            try {
                await importDeck(answer);
                console.log("✅ Deck imported successfully.");
                process.exit(0);
            } catch (error) {
                console.error("❌ Error importing deck:", error);
                process.exit(1);
            }
        }
    );
} else {
    const deckIds = process.argv.slice(2);
    (async () => {
        for (const deckId of deckIds) {
            try {
                console.log(`🔄 Importing deck with ID: ${deckId}`);
                await importDeck(deckId.trim().toUpperCase());
                console.log(`\t✅ Deck ${deckId} imported successfully.\n`);
            }
            catch (error) {
                console.error(`\t❌ Error importing deck ${deckId}:`, error, "\n");
            }
        }
    })();

}
