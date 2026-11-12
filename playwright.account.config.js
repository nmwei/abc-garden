import { defineConfig } from "@playwright/test";
import existing from "./playwright.config.js";
export default defineConfig({
  ...existing,
  testMatch: "account.spec.js",
  use: { ...existing.use, baseURL: "http://localhost:4283" },
  webServer: {
    command: "node tests/account-server.mjs",
    url: "http://localhost:4283",
    reuseExistingServer: false,
  },
});
