import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { getTestDatabaseUrl } from "../testing/integrationDatabase";

const serverDirectory = resolve(import.meta.dirname, "../..");
const testDatabaseUrl = getTestDatabaseUrl();
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const run = (args: string[], env = process.env) => {
  const result = spawnSync(pnpm, ["exec", ...args], {
    cwd: serverDirectory,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["prisma", "generate"]);
run(["prisma", "db", "push"], {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
});
run(["vitest", "run", "--config", "vitest.integration.config.ts"]);
