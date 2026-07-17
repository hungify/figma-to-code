import { defineConfig } from "vitest/config";

/** App / feature unit tests only — not agent scripts under `.agents/`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
