import 'dotenv/config';
import { defineConfig, env } from "prisma/config";
import { bootConfig } from "./src/utils/config";
bootConfig();
export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: env("DATABASE_URL"),
    }
});