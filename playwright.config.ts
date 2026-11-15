import { defineConfig, devices } from '@playwright/test';

const preview = process.env.QA_SERVER_MODE === 'preview';
const port = preview ? 5183 : 5173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 1,
  outputDir: process.env.QA_OUTPUT_DIR ?? 'test-results',
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium', channel: process.env.QA_BROWSER_CHANNEL } },
    // Windows WebKit needs a larger whole-scenario budget; assertion deadlines are unchanged.
    { name: 'mobile-webkit', timeout: 90000, use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'webkit' } },
  ],
  webServer: { command: `npm run ${preview ? 'preview' : 'dev'} -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: !process.env.CI },
});
