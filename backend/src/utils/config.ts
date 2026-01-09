import dotenv from "dotenv";
import fs from "fs";
import path from "path";

export const bootConfig = () => {
    // check if .env file exists in root directory
    const rootEnv = path.resolve(__dirname, "../../.env");
    const prodEnv = path.resolve(__dirname, "../../.env.production");
    const devEnv = path.resolve(__dirname, "../../.env.development");
    if (fs.existsSync(rootEnv)) {
        dotenv.config({ path: rootEnv });
    }

    if (process.env.ENVIRONMENT === "development") {
        if (fs.existsSync(devEnv)) {
            dotenv.config({ path: devEnv });
        }
    } else if (fs.existsSync(prodEnv)) {
        dotenv.config({ path: prodEnv });
    }
}