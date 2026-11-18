import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Runs only in the real-* projects: VITE_API_MODE=real, /api proxied to tests/support/fake-auth-backend.mjs.
const backend = 'http://127.0.0.1:8099';
const control = (action: string) => fetch(`${backend}/__test__/${action}`, { method: 'POST' });
const createUser = (email: string, password = 'Password1!', nickname = '먼저온친구') =>
  fetch(`${backend}/api/v1/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, nickname }) });
const storedRefresh = (page: Page) => page.evaluate(() => sessionStorage.getItem('teslang:refresh-token'));

async function fill(page: Page, { email, password, nickname }: { email: string; password: string; nickname?: string }) {
  await page.getByLabel('이메일').fill(email);
  if (nickname !== undefined) await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
}

test.beforeEach(async () => { await control('reset'); });

test('sign up, keep the login across a reload, then log out', async ({ page }) => {
  await page.goto('/archive');
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
  await expect(page.getByText('상담·기록·말랑이는 아직 예시 데이터')).toBeVisible();
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await fill(page, { email: 'Maum@Example.com ', password: 'Password1!', nickname: '말랑친구' });
  await page.getByRole('button', { name: '가입하고 시작하기' }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByRole('button', { name: '월간', exact: true })).toBeVisible();

  // Refresh token only in sessionStorage; nothing in localStorage; access token never persisted.
  expect(await storedRefresh(page)).toMatch(/^refresh-/);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => Object.values(sessionStorage).some(value => value.startsWith('access-')))).toBe(false);

  await page.reload();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByRole('button', { name: '월간', exact: true })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByText('말랑친구')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await storedRefresh(page)).toBeNull();
  await page.goto('/archive');
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
});

test('shows readable errors for wrong credentials, a taken email and a short password', async ({ page }) => {
  await createUser('taken@example.com');
  await page.goto('/login');
  await fill(page, { email: 'taken@example.com', password: 'WrongPass1!' });
  await page.getByRole('button', { name: '로그인', exact: true }).last().click();
  await expect(page.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 맞지 않아요.');
  expect(await page.getByLabel('비밀번호', { exact: true }).inputValue()).toBe('WrongPass1!');

  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('');
  await fill(page, { email: 'taken@example.com', password: 'short', nickname: '새친구' });
  await expect(page.getByText('8자 이상 72자 이하로 입력해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '가입하고 시작하기' })).toBeDisabled();
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!');
  await page.getByRole('button', { name: '가입하고 시작하기' }).click();
  await expect(page.getByRole('alert')).toHaveText('이미 가입된 이메일이에요. 이메일 계정으로 로그인해 주세요.');
  await expect(page).toHaveURL(/\/login$/);
});

test('renews an expired access token silently and returns to login when the session ends', async ({ page }) => {
  await createUser('keep@example.com');
  await page.goto('/login?next=%2Farchive');
  await fill(page, { email: 'keep@example.com', password: 'Password1!' });
  await page.getByRole('button', { name: '로그인', exact: true }).last().click();
  await expect(page).toHaveURL(/\/archive$/);
  const first = await storedRefresh(page);

  await control('expire-access');
  await page.reload();
  await expect(page.getByRole('button', { name: '월간', exact: true })).toBeVisible();
  const rotated = await storedRefresh(page);
  expect(rotated).toMatch(/^refresh-/);
  expect(rotated).not.toBe(first);

  await control('expire-all');
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
  expect(await storedRefresh(page)).toBeNull();
});

test('the dev proxy forwards /api without the browser Origin header', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(() => fetch('/api/v1/__test__/origin', { method: 'POST' }).then(response => response.json()));
  expect(result).toEqual({ success: true, data: { origin: null }, error: null });
});

for (const [width, height] of [[360, 740], [390, 844], [430, 932]] as const) {
  test(`email form fits ${width}px with 44px controls`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/login');
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    for (const control of [page.getByLabel('이메일'), page.getByLabel('닉네임'), page.getByLabel('비밀번호', { exact: true }), page.getByRole('button', { name: '비밀번호 보기' }), page.getByRole('button', { name: '로그인', exact: true })]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('비밀번호', { exact: true }).fill('Password1!');
    await page.getByRole('button', { name: '비밀번호 보기' }).click();
    await expect(page.getByLabel('비밀번호', { exact: true })).toHaveAttribute('type', 'text');
    await page.screenshot({ path: `${process.env.QA_OUTPUT_DIR ?? 'test-results'}/auth-signup-${width}-${test.info().project.name}.png` });
  });
}
