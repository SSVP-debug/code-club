import { defineConfig } from "vitest/config";
import { canonicalProblemBankResolver } from "./utils/canonicalProblemBankResolver.js";

// Node-environment config for backend tests — no jsdom (that's the
// frontend's vitest.config.js at the repo root). Tests mock Mongoose
// models and external calls (Judge0, Firebase Admin) directly via vi.mock.
export default defineConfig({
  plugins: [canonicalProblemBankResolver()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./utils/problemIdentityBootstrap.js"],
    include: ["**/*.test.js"],
    exclude: ["node_modules", "problems", "**/*.integration.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      include: ["**/*.js"],
      exclude: [
        "**/*.test.js",
        "**/*.integration.test.js",
        "scripts/**",
        "problems/**",
        "server.js",
        "instrument.js",
        "node_modules/**",
      ],
    },
  },
});
