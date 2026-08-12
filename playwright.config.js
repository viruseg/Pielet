import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173/demo/',
    headless: true
  },
  webServer: {
    command: 'npm run dev:demo',
    url: 'http://localhost:5173/demo/',
    reuseExistingServer: true
  }
});