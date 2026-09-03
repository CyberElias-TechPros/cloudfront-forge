import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // `node:sqlite` powers the in-memory D1 used by the handler tests; it must
    // stay a real Node builtin instead of being bundled by Vite.
    server: {
      deps: {
        external: [/^node:/],
      },
    },
    // node:sqlite prints an experimental warning on first use.
    onConsoleLog(log) {
      if (log.includes("ExperimentalWarning: SQLite")) return false;
      return true;
    },
  },
});
