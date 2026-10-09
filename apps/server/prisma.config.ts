import { defineConfig, env } from "prisma/config";
import {config as loadEnv} from "dotenv"
import path from "path";
loadEnv({
  path: path.resolve(__dirname, "../../.env")
});
export default defineConfig({
  schema: "src/prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL")
  },
});