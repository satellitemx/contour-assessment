import { expect, test } from '@playwright/test';
import { loginViaUi, logoutViaUi, resetE2EState } from './helpers';

test.describe('Admin Views & Attribute-Composed RBAC', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EState(request);
  });

  test('denies standard learner access to admin routes', async ({ page }) => {
    await loginViaUi(page, 'student@example.org');
    await page.goto('/admin/consultations');
    await expect(page.getByText('Access Restricted')).toBeVisible();

    await page.goto('/admin/roles');
    await expect(page.getByText('Access Restricted')).toBeVisible();
  });

  test('auditor views all consultations in read-only mode', async ({ page }) => {
    await loginViaUi(page, 'auditor@example.org');
    await expect(page).toHaveURL(/\/admin\/consultations/);
    await expect(page.getByText('Read-only', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('tbody')).toContainText('student@example.org');

    // No student action buttons present in read-only admin view
    await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  });

  test('super admin composes a custom role with mixed attributes and assigns it to a user', async ({
    page,
  }) => {
    await loginViaUi(page, 'superadmin@example.org');
    await page.goto('/admin/roles');
    await expect(
      page.getByRole('heading', { name: 'Roles & Attribute Composition' }),
    ).toBeVisible();

    // 1. Create custom role composing read:own + read:all
    await page.getByTestId('create-role-button').click();
    const roleModal = page.getByRole('dialog', { name: 'Compose Custom Role' });
    await expect(roleModal).toBeVisible();

    await roleModal.getByLabel('Role name').fill('Course Mentor');
    await roleModal
      .getByLabel('Description')
      .fill('Can inspect own consultations and audit all system consultations.');

    await roleModal.getByLabel(/View own consultations/i).check();
    await roleModal.getByLabel(/View all system consultations/i).check();
    await roleModal.getByRole('button', { name: 'Create role' }).click();
    await expect(roleModal).toBeHidden();

    await expect(page.getByTestId('role-card-course-mentor')).toBeVisible();

    // 2. Switch to User Role Assignments tab and assign "Course Mentor" to student@example.org
    await page.getByRole('tab', { name: /User Role Assignments/i }).click();
    const studentRow = page.getByTestId('user-row-student@example.org');
    await expect(studentRow).toBeVisible();

    const rolesInput = page.getByRole('textbox', { name: 'Roles for student@example.org' });
    await rolesInput.click();
    await page.getByRole('option', { name: 'Course Mentor' }).click();
    await page.keyboard.press('Escape');

    await page.getByTestId('save-user-roles-student@example.org').click();
    await expect(studentRow).toContainText('consultations:read:all');
    await expect(studentRow).toContainText('consultations:read:own');

    // 3. Log in as student@example.org and verify dynamically composed access
    await logoutViaUi(page);
    await loginViaUi(page, 'student@example.org');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: /My Consultations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /All Consultations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Roles & Access/i })).toHaveCount(0);

    await page.getByRole('link', { name: /All Consultations/i }).click();
    await expect(page).toHaveURL(/\/admin\/consultations/);
    await expect(page.locator('tbody tr')).toHaveCount(3);

    await page.goto('/admin/roles');
    await expect(page.getByText('Access Restricted')).toBeVisible();
  });
});
