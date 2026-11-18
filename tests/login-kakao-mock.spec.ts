import { test, expect } from '@playwright/test';

// mock mode (default run): the official Kakao button is always shown. Without VITE_KAKAO_CLIENT_ID it cannot
// start, and a callback cannot be completed without the backend; both cases explain instead of failing silently.
test('mock login always shows the Kakao button and explains what it still needs', async ({ page }) => {
  await page.goto('/login?next=%2Farchive');
  const kakao = page.getByRole('button', { name: '카카오 로그인' });
  await expect(kakao).toBeInViewport();
  await expect(page.getByRole('button', { name: '체험 계정으로 계속하기' })).toBeInViewport();
  await kakao.click();
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
  await expect(page.getByRole('alert')).toHaveText('카카오 로그인 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.');

  await page.evaluate(() => sessionStorage.setItem('teslang:oauth-pending', JSON.stringify({ provider: 'kakao', state: 's1', next: '/archive', redirectUri: 'x' })));
  await page.goto('/oauth/callback/kakao?code=c&state=s1');
  await expect(page.getByRole('alert')).toHaveText('카카오 로그인은 실제 서버에 연결된 상태(real 모드)에서만 완료할 수 있어요.');
  await page.getByRole('link', { name: '로그인 화면으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Farchive$/);
});
