import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL(".", import.meta.url));

await build({
  entryPoints: [resolve(serverRoot, "src/index.ts")],
  tsconfig: resolve(serverRoot, "tsconfig.json"),
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: {
    "@repo/shared/types": resolve(
      serverRoot,
      "../../packages/shared/types.ts",
    ),
  },
  outfile: resolve(serverRoot, "dist/index.js"),
});
