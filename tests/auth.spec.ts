import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Runs only in the real-* projects: VITE_API_MODE=real, /api proxied to tests/support/fake-auth-backend.mjs,
// VITE_KAKAO_CLIENT_ID set so the Kakao button is shown. Kakao itself is replaced by a page.route redirect.
const backend = 'http://127.0.0.1:8099';
const control = (action: string) => fetch(`${backend}/__test__/${action}`, { method: 'POST' });
const createUser = (email: string, password = 'Password1!', nickname = '먼저온친구') =>
  fetch(`${backend}/api/v1/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, nickname }) });
const storedRefresh = (page: Page) => page.evaluate(() => sessionStorage.getItem('teslang:refresh-token'));

async function openEmail(page: Page) {
  await page.getByRole('button', { name: '이메일로 시작하기' }).click();
  const sheet = page.getByRole('dialog', { name: '이메일로 시작하기' });
  await expect(sheet).toBeVisible();
  return sheet;
}
async function fill(sheet: Locator, { email, password, nickname }: { email: string; password: string; nickname?: string }) {
  await sheet.getByLabel('이메일').fill(email);
  if (nickname !== undefined) await sheet.getByLabel('닉네임').fill(nickname);
  await sheet.getByLabel('비밀번호', { exact: true }).fill(password);
}
const submitLogin = (sheet: Locator) => sheet.getByRole('button', { name: '로그인', exact: true }).last().click();
/** Stands in for kauth.kakao.com: sends the browser back to the callback with the given code or error. */
async function fakeKakao(page: Page, result: { code?: string; error?: string }) {
  await page.route('https://kauth.kakao.com/**', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('client_id')).toBe('test-kakao-client');
    const back = new URL(url.searchParams.get('redirect_uri')!);
    back.searchParams.set('state', url.searchParams.get('state')!);
    if (result.code) back.searchParams.set('code', result.code);
    if (result.error) back.searchParams.set('error', result.error);
    // WebKit cannot fulfill a 30x here, so the stand-in page redirects itself.
    return route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(back.toString())})</script>` });
  });
}

test.beforeEach(async () => { await control('reset'); });

test('landing follows the Figma login frame with the official Kakao button and email only', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '테슬랑' })).toBeVisible();
  await expect(page.getByText('마음에도 말랑한 쉼표가 필요하니까,')).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오 로그인' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '이메일로 시작하기' })).toBeInViewport();
  for (const hidden of [/APPLE|APLLE/i, '전화번호로 회원가입', '비밀번호 찾기']) await expect(page.getByText(hidden)).toHaveCount(0);
  // Official Kakao Developers button (224x46) centered in a #FEE500 container widened to the 315px column.
  const kakao = page.getByRole('button', { name: '카카오 로그인' });
  const box = (await kakao.boundingBox())!;
  expect(Math.round(box.width)).toBe(315); expect(Math.round(box.height)).toBe(46);
  await expect(kakao).toHaveCSS('background-color', 'rgb(254, 229, 0)');
  await expect(kakao).toHaveCSS('border-radius', '12px');
  expect(await kakao.locator('img').evaluate((img: HTMLImageElement) => [img.complete && img.naturalWidth > 0, img.getAttribute('src')])).toEqual([true, '/assets/design/kakao-login-complete-ko.svg']);
  expect(await page.getByRole('heading', { name: '테슬랑' }).locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('sign up, keep the login across a reload, then log out', async ({ page }) => {
  await page.goto('/archive');
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
  const sheet = await openEmail(page);
  await expect(sheet.getByText('상담·기록·말랑이는 아직 예시 데이터')).toBeVisible();
  await sheet.getByRole('button', { name: '회원가입', exact: true }).click();
  await fill(sheet, { email: 'Maum@Example.com ', password: 'Password1!', nickname: '말랑친구' });
  await sheet.getByRole('button', { name: '가입하고 시작하기' }).click();
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
  const sheet = await openEmail(page);
  await fill(sheet, { email: 'taken@example.com', password: 'WrongPass1!' });
  await submitLogin(sheet);
  await expect(sheet.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 맞지 않아요.');
  expect(await sheet.getByLabel('비밀번호', { exact: true }).inputValue()).toBe('WrongPass1!');

  await sheet.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(sheet.getByLabel('비밀번호', { exact: true })).toHaveValue('');
  await fill(sheet, { email: 'taken@example.com', password: 'short', nickname: '새친구' });
  await expect(sheet.getByText('8자 이상 72자 이하로 입력해 주세요.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '가입하고 시작하기' })).toBeDisabled();
  await sheet.getByLabel('비밀번호', { exact: true }).fill('Password1!');
  await sheet.getByRole('button', { name: '가입하고 시작하기' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('이미 가입된 이메일이에요. 이메일 계정으로 로그인해 주세요.');
  await expect(page).toHaveURL(/\/login$/);

  await sheet.getByRole('button', { name: '닫기' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이메일로 시작하기' })).toBeFocused();
});

test('renews an expired access token silently and returns to login when the session ends', async ({ page }) => {
  await createUser('keep@example.com');
  await page.goto('/login?next=%2Farchive');
  const sheet = await openEmail(page);
  await fill(sheet, { email: 'keep@example.com', password: 'Password1!' });
  await submitLogin(sheet);
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

test('Kakao login exchanges the code once and returns to the original page', async ({ page }) => {
  await fakeKakao(page, { code: 'good-code' });
  await page.goto('/login?next=%2Farchive');
  await page.getByRole('button', { name: '카카오 로그인' }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByRole('button', { name: '월간', exact: true })).toBeVisible();
  expect(await storedRefresh(page)).toMatch(/^refresh-/);
  expect(await page.evaluate(() => sessionStorage.getItem('teslang:oauth-pending'))).toBeNull();
  await page.goto('/settings');
  await expect(page.getByText('카카오친구')).toBeVisible();
});

test('Kakao callback explains cancel, an existing email account and a forged state', async ({ page }) => {
  await fakeKakao(page, { error: 'access_denied' });
  await page.goto('/login?next=%2Farchive');
  await page.getByRole('button', { name: '카카오 로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('카카오 로그인을 취소했어요.');
  await page.getByRole('link', { name: '로그인 화면으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);

  await page.unrouteAll();
  await fakeKakao(page, { code: 'dup-code' });
  await page.getByRole('button', { name: '카카오 로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('이미 가입된 이메일이에요. 이메일 계정으로 로그인해 주세요.');
  expect(await storedRefresh(page)).toBeNull();

  // A callback that this tab did not start must not reach the backend.
  await page.goto('/oauth/callback/kakao?code=good-code&state=forged');
  await expect(page.getByRole('alert')).toHaveText('로그인 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.');
  expect(await storedRefresh(page)).toBeNull();
});

test('the dev proxy forwards /api without the browser Origin header', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(() => fetch('/api/v1/__test__/origin', { method: 'POST' }).then(response => response.json()));
  expect(result).toEqual({ success: true, data: { origin: null }, error: null });
});

const out = (name: string) => `${process.env.QA_OUTPUT_DIR ?? 'test-results'}/auth-${name}-${test.info().project.name}.png`;
for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390]] as const) {
  test(`login landing and email sheet fit ${width}x${height} with 44px controls`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: '이메일로 시작하기' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: out(`landing-${width}x${height}`) });
    const sheet = await openEmail(page);
    await sheet.getByRole('button', { name: '회원가입', exact: true }).click();
    for (const control of [sheet.getByLabel('이메일'), sheet.getByLabel('닉네임'), sheet.getByLabel('비밀번호', { exact: true }), sheet.getByRole('button', { name: '비밀번호 보기' }), sheet.getByRole('button', { name: '로그인', exact: true })]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await sheet.getByLabel('비밀번호', { exact: true }).fill('Password1!');
    await sheet.getByRole('button', { name: '비밀번호 보기' }).click();
    await expect(sheet.getByLabel('비밀번호', { exact: true })).toHaveAttribute('type', 'text');
    await page.screenshot({ path: out(`sheet-${width}x${height}`) });
  });
}
