import { expect, test } from '@playwright/test';
import { loginViaUi, resetE2EState } from './helpers';

test.describe('Internationalization (English & Simplified Chinese)', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request);
  });

  test('auto-detects Chinese browser Accept-Language for visitors while existing users default to English', async ({
    browser,
  }) => {
    const zhContext = await browser.newContext({
      locale: 'zh-CN',
      extraHTTPHeaders: {
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    const page = await zhContext.newPage();

    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: '欢迎回到 Contour LMS' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

    // Existing seeded user has preferredLocale = 'en', so logging in uses English by default
    await page.getByLabel('邮箱地址').fill('auditor@example.org');
    await page.getByLabel('密码').fill('ChangeMe123!');
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page).toHaveURL(/\/admin\/consultations/);
    await expect(
      page.getByRole('heading', { name: 'All System Consultations' }),
    ).toBeVisible();

    await zhContext.close();
  });

  test('visitor can toggle language on login page before signing in', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Welcome back to Contour LMS' }),
    ).toBeVisible();

    await page
      .getByTestId('visitor-language-switcher')
      .locator('label', { hasText: '简体中文' })
      .click();

    await expect(
      page.getByRole('heading', { name: '欢迎回到 Contour LMS' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('authenticated user can change language preference in Settings and persist across sessions', async ({
    page,
  }) => {
    await loginViaUi(page, 'student@example.org');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { name: 'My Consultations' }),
    ).toBeVisible();

    // Open Settings via user menu
    await page.getByTestId('user-menu-button').click();
    await page.getByTestId('settings-menu-item').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole('heading', { name: 'Account Settings' }),
    ).toBeVisible();

    // Select Simplified Chinese and save
    await page.getByTestId('settings-language-select').click();
    await page.getByRole('option', { name: /简体中文/ }).click();
    await page.getByTestId('save-settings-button').click();

    // UI immediately switches to Simplified Chinese
    await expect(
      page.getByRole('heading', { name: '账户设置' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /我的咨询/ }),
    ).toBeVisible();

    // Navigate to dashboard and verify Chinese localization
    await page.getByRole('link', { name: /我的咨询/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { name: '我的咨询' }),
    ).toBeVisible();
    await expect(page.getByTestId('open-booking-modal-button')).toContainText(
      '预约咨询',
    );

    // Reload and verify persistence
    await page.reload();
    await expect(
      page.getByRole('heading', { name: '我的咨询' }),
    ).toBeVisible();

    // Sign out and sign back in; persisted user setting remains Simplified Chinese
    await page.getByTestId('user-menu-button').click();
    await page.getByTestId('logout-button').click();
    await page.waitForURL(/\/login/);

    await page.getByLabel(/Email address|邮箱地址/).fill('student@example.org');
    await page.getByLabel(/Password|密码/).fill('ChangeMe123!');
    await page.getByRole('button', { name: /Sign in|登录/ }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('heading', { name: '我的咨询' }),
    ).toBeVisible();
  });
});
