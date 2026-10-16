import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(import.meta.dirname, "../../../../.env") });

const databaseIdentity = (value: string) => {
  const url = new URL(value);
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`;
};

export const getTestDatabaseUrl = () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database.");
  }

  let testDatabaseIdentity: string;
  try {
    testDatabaseIdentity = databaseIdentity(testDatabaseUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  for (const [name, value] of [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["SHADOW_DATABASE_URL", process.env.SHADOW_DATABASE_URL],
  ] as const) {
    if (value && databaseIdentity(value) === testDatabaseIdentity) {
      throw new Error(`TEST_DATABASE_URL must point to a different database from ${name}.`);
    }
  }

  return testDatabaseUrl;
};
