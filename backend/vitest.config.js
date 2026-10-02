import { defineConfig } from "vitest/config";

// Node-environment config for backend tests — no jsdom (that's the
// frontend's vitest.config.js at the repo root). Tests mock Mongoose
// models and external calls (Judge0, Firebase Admin) directly via
// vi.mock rather than hitting a real database — see backend/test/README.md
// for the reasoning and for how to extend this once integration tests
// (e.g. via mongodb-memory-server) are worth the added setup cost.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./utils/problemIdentityBootstrap.js"],
    include: ["**/*.test.js"],
    exclude: ["node_modules", "problems", "**/*.integration.test.js"],

    // Coverage reporting (audit finding, Aug 2026 — no coverage tooling
    // existed at all before this, same as the frontend's vitest.config.js).
    // No `thresholds` set yet — see that file's comment for why guessing a
    // number is worse than not having one. Run `npm run test:coverage`
    // locally or read the CI report (ci.yml) to get a real baseline first.
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      include: ["**/*.js"],
      exclude: [
        "**/*.test.js",
        "**/*.integration.test.js",
        "scripts/**",   // CLI/ops tooling, run manually not as request-path code
        "problems/**",  // problem-bank data files, not application logic
        "server.js",    // wiring/bootstrap, exercised end-to-end not unit-tested
        "instrument.js",
        "node_modules/**",
      ],
    },
  },
});