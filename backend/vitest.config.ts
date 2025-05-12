/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,         // enables describe/it/expect globally
    environment: 'node',   // or 'jsdom' if you're testing UI later
    setupFiles: [],        // you can add a setup file here if needed
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  },
});
