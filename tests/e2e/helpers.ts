import { expect, type APIRequestContext, type Page } from '@playwright/test';

export async function resetE2EState(request: APIRequestContext) {
  const res = await request.post('/api/test/reset');
  expect(res.ok()).toBe(true);
}

export async function loginViaUi(
  page: Page,
  email: string,
  password = 'ChangeMe123!',
) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function logoutViaUi(page: Page) {
  await page.getByTestId('user-menu-button').click();
  await page.getByTestId('logout-button').click();
  await page.waitForURL(/\/login/);
}
