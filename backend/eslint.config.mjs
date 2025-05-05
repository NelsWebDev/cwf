// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig, // disables ESLint stylistic rules that conflict with Prettier
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error", // show Prettier issues as ESLint errors
    },
  },
  globalIgnores(["dist/*"]),
);
