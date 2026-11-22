import { expect, test } from '@playwright/test';
import { loginViaUi, logoutViaUi, resetE2EState } from './helpers';

test.describe('Authentication & Session Flows', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request);
  });

  test('redirects unauthenticated protected requests to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Welcome back to Contour LMS')).toBeVisible();
  });

  test('shows error message on invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('student@example.org');
    await page.getByLabel('Password').fill('WrongPassword999');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('allows user to sign up, reach dashboard, sign out, and sign back in', async ({
    page,
  }) => {
    await page.goto('/signup');
    await page.getByLabel('First name').fill('Nadia');
    await page.getByLabel('Last name').fill('Okafor');
    await page.getByLabel('Email address').fill('nadia.okafor@example.org');
    await page.getByLabel('Password').fill('StrongPass123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'My Consultations' })).toBeVisible();
    await expect(page.getByTestId('open-booking-modal-button')).toBeVisible();

    await logoutViaUi(page);
    await expect(page).toHaveURL(/\/login/);

    await loginViaUi(page, 'nadia.okafor@example.org', 'StrongPass123!');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'My Consultations' })).toBeVisible();
  });
});
