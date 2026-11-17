import type { Page } from '@playwright/test';
// Test-only transport failure injection; never expose controls in the product UI.
export async function failOnce(page: Page, path: string, method: string, message: string) {
  await page.evaluate(({ path, method, message }) => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input).startsWith(path) && (init?.method ?? 'GET') === method) {
        window.fetch = original;
        return Promise.resolve(Response.json({ message }, { status: 503 }));
      }
      return original(input, init);
    };
  }, { path, method, message });
}
