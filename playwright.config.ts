import { defineConfig } from 'playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
