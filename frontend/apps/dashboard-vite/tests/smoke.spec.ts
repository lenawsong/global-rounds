import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', heading: 'Overview' },
  { path: '/ops', heading: 'Ops' },
  { path: '/finance', heading: 'Finance' },
  { path: '/inventory', heading: 'Inventory' },
  { path: '/engagement', heading: 'Engagement' },
  { path: '/scenarios', heading: 'Scenarios' },
  { path: '/ask', heading: 'Ask' },
  { path: '/agents', heading: 'Agents' },
  { path: '/lexicon', heading: 'Lexicon' }
];

test.describe('Dashboard navigation', () => {
  for (const route of routes) {
    test(`navigates to ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    });
  }
});
