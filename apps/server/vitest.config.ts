import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // maxCols stops long file names from being truncated to "...Name.ts"
      reporter: [["text", { maxCols: 200 }], "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/testing/**",
        "src/prisma/generated/**",
        "src/scripts/**",
        // Startup wiring and static schema text; nothing to unit test.
        "src/index.ts",
        "src/rooms.ts",
        "src/singletons.ts",
        "src/graphql/index.ts",
        "src/graphql/typeDefs.ts",
      ],
    },
  },
});
