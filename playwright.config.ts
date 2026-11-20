import { defineConfig, devices } from '@playwright/test';

const preview = process.env.QA_SERVER_MODE === 'preview';
// Own ports so E2E never reuses a developer's `npm run dev` (real mode by default) on 5173.
const port = preview ? 5183 : 5185;
const baseURL = `http://127.0.0.1:${port}`;
// Authenticated entry/sleep/counseling use their own dev server and controlled auth backend.
const realURL = 'http://127.0.0.1:5184';
const fakeAuth = 'http://127.0.0.1:8099';
const real = /(?:auth|live-counseling|sleep|entry-edge|mobile-viewport|manual-review)\.spec\.ts/;

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
    { name: 'mobile-chromium', testIgnore: real, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium', channel: process.env.QA_BROWSER_CHANNEL } },
    // Windows WebKit needs a larger whole-scenario budget; assertion deadlines are unchanged.
    { name: 'mobile-webkit', testIgnore: real, timeout: 90000, use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'webkit' } },
    { name: 'real-chromium', testMatch: real, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium', channel: process.env.QA_BROWSER_CHANNEL, baseURL: realURL } },
    { name: 'real-webkit', testMatch: real, timeout: 90000, use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'webkit', baseURL: realURL } },
  ],
  webServer: [
    // Example-data projects. Default `npm run dev` is real mode, so pin mock here; preview QA serves `npm run build:mock`.
    { command: `npm run ${preview ? 'preview' : 'dev:mock'} -- --port ${port} --strictPort`, url: baseURL, env: { VITE_API_MODE: 'mock' }, reuseExistingServer: !process.env.CI },
    { command: 'node tests/support/fake-auth-backend.mjs', url: `${fakeAuth}/__test__/origin`, reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --port 5184 --strictPort', url: realURL, env: { VITE_API_MODE: 'real', VITE_API_BASE_URL: '', VITE_API_PROXY_TARGET: fakeAuth }, reuseExistingServer: !process.env.CI },
  ],
});
