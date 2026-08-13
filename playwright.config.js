import { defineConfig } from "@playwright/test";

// Dedicated port so the suite never picks up an unrelated dev server. 8080 is a
// common default and was previously being tested by accident.
const PORT = process.env.PORT || 8288;

export default defineConfig({
  testDir: "./test",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  // Build and serve _dist ourselves so `npm run test` is self-contained.
  // reuseExistingServer stays false: if the port is busy we want a loud failure
  // rather than silently testing whatever is already listening.
  webServer: {
    command: `npm run build && npx --yes http-server _dist/ -p ${PORT} --silent`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
