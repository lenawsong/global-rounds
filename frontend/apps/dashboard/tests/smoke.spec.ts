import { test, expect } from '@playwright/test';

test('dashboard shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Command Center')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ops' })).toBeVisible();
});

