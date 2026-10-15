import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // maxCols stops long file names from being truncated to "...Name.ts"
      reporter: [["text", { maxCols: 200 }], "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**", "src/prisma/generated/**", "src/scripts/**"],
    },
  },
});
