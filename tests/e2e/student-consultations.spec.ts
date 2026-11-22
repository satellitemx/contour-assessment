import { expect, test } from '@playwright/test';
import { loginViaUi, resetE2EState } from './helpers';

test.describe('Student Consultation Dashboard', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetE2EState(request);
    await loginViaUi(page, 'student@example.org');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('books a new consultation, toggles completion, reschedules, cancels, and filters', async ({
    page,
  }) => {
    await expect(page.getByTestId('stat-total')).toHaveText('3');

    // 1. Open booking modal and create consultation
    await page.getByTestId('open-booking-modal-button').click();
    const dialog = page.getByRole('dialog', { name: 'Book a Consultation' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('First name').fill('Maya');
    await dialog.getByLabel('Last name').fill('Lin');
    await dialog
      .getByLabel('Reason for consultation')
      .fill('Distributed systems project milestone review');

    // Adjust start time via Mantine DateTimePicker popover
    await dialog.getByLabel('Start date & time').click();
    await page.getByLabel('Start hours').fill('13');
    await page.getByLabel('Start minutes').fill('30');
    await page.getByLabel('Confirm start date and time').click();

    // Adjust end time via Mantine DateTimePicker popover
    await dialog.getByLabel('End date & time').click();
    await page.getByLabel('End hours').fill('14');
    await page.getByLabel('End minutes').fill('30');
    await page.getByLabel('Confirm end date and time').click();

    await dialog.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(dialog).toBeHidden();

    // Verify created row appears & stats updated
    const newRow = page
      .locator('tbody tr')
      .filter({ hasText: 'Distributed systems project milestone review' });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText('Scheduled');
    await expect(page.getByTestId('stat-total')).toHaveText('4');
    await expect(page.getByTestId('stat-scheduled')).toHaveText('2');

    // 2. Mark consultation complete
    await newRow.getByRole('button', { name: 'Mark complete' }).click();
    await expect(newRow).toContainText('Completed');
    await expect(page.getByTestId('stat-completed')).toHaveText('2');

    // 3. Mark consultation incomplete
    await newRow.getByRole('button', { name: 'Mark incomplete' }).click();
    await expect(newRow).toContainText('Scheduled');
    await expect(page.getByTestId('stat-scheduled')).toHaveText('2');

    // 4. Reschedule consultation
    await newRow.getByRole('button', { name: 'Reschedule' }).click();
    const rescheduleDialog = page.getByRole('dialog', {
      name: 'Reschedule Consultation',
    });
    await expect(rescheduleDialog).toBeVisible();
    await rescheduleDialog.getByLabel('New start date & time').click();
    await page.getByLabel('Reschedule start hours').fill('15');
    await page.getByLabel('Reschedule start minutes').fill('00');
    await page.getByLabel('Confirm rescheduled start').click();

    await rescheduleDialog.getByLabel('New end date & time').click();
    await page.getByLabel('Reschedule end hours').fill('16');
    await page.getByLabel('Reschedule end minutes').fill('00');
    await page.getByLabel('Confirm rescheduled end').click();

    await rescheduleDialog.getByRole('button', { name: 'Save new time' }).click();
    await expect(rescheduleDialog).toBeHidden();
    await expect(newRow).toContainText('15:00 – 16:00');

    // 5. Cancel consultation
    await newRow.getByRole('button', { name: 'Cancel' }).click();
    const cancelDialog = page.getByRole('dialog', {
      name: 'Cancel Consultation',
    });
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(cancelDialog).toBeHidden();

    await expect(newRow).toContainText('Cancelled');
    await expect(page.getByTestId('stat-cancelled')).toHaveText('2');

    // 6. Filter via SegmentedControl & search
    await page.locator('.mantine-SegmentedControl-label', { hasText: 'Completed' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText(
      'Algorithms module dynamic programming walkthrough',
    );
  });
});
