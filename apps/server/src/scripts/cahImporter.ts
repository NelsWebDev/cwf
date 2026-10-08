import { readFile } from "node:fs/promises";
import path from "node:path";
import { prismaClient } from "../singletons";
import { importCahCompact, type CAHCompact } from "../utils/cahCompactImporter";

const DATA_FILE = path.resolve(import.meta.dirname, "../../../../cah-cards-compact.json");

(async () => {
    try {
        console.log("🔄 Starting CAH import...");
        const data = JSON.parse(await readFile(DATA_FILE, "utf8")) as CAHCompact;
        console.log(
            `📦 Found ${Object.keys(data.packs).length} packs, ${data.white.length} white and ${data.black.length} black cards.`
        );
        await importCahCompact(prismaClient, data, console.log);
    } catch (error) {
        console.error("❌ Deck import failed:", error);
        process.exitCode = 1;
    }
})();
