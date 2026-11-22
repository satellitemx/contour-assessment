import { expect, test } from '@playwright/test';
import { loginViaUi, resetE2EState } from './helpers';

test.describe('Responsive Viewport Layout', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request);
  });

  test('renders cleanly without horizontal overflow and supports navigation across viewports', async ({
    page,
  }) => {
    await loginViaUi(page, 'superadmin@example.org');

    // Navigate to student dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'My Consultations' })).toBeVisible();

    const viewport = page.viewportSize();
    const isMobile = (viewport?.width ?? 1280) < 768;

    if (isMobile) {
      // Burger opens mobile drawer navigation
      const burger = page.getByLabel('Toggle navigation menu');
      await expect(burger).toBeVisible();
      await burger.click();
      await expect(page.getByRole('link', { name: /All Consultations/i })).toBeVisible();
      await page.getByRole('link', { name: /All Consultations/i }).click();
      await expect(page).toHaveURL(/\/admin\/consultations/);
      await expect(page.locator('[data-testid^="admin-consultation-card-"]')).toHaveCount(3);
    } else {
      await expect(page.locator('[data-testid^="consultation-row-"]')).toHaveCount(0);
    }

    // Verify no horizontal overflow on key pages
    for (const route of ['/dashboard', '/admin/consultations', '/admin/roles']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(overflow).toBe(false);
    }
  });
});
