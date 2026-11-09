import { expect, test } from '@playwright/test';

test.describe('Keyboard Accessibility & Mandatory Disclaimers (NFR-06, NFR-10)', () => {
  test('supports full keyboard navigation without WebGL mouse interaction and displays all 3 caveats', async ({
    page,
  }) => {
    await page.goto('/');

    // Press '/' shortcut to focus search input
    await page.keyboard.press('/');
    await expect(page.getByTestId('search-input')).toBeFocused();

    // Focus first event option in listbox and activate with Enter
    const firstOption = page.locator('[role="option"]').first();
    await firstOption.focus();
    await page.keyboard.press('Enter');

    const drawer = page.getByTestId('event-detail-drawer');
    await expect(drawer).toBeVisible();

    // Verify all 3 mandatory caveats are visible in the DOM
    await expect(page.getByTestId('footer-caveat-geometry')).toBeVisible();
    await expect(page.getByTestId('footer-caveat-density')).toBeVisible();
    await expect(page.getByTestId('footer-caveat-news')).toBeVisible();

    // Press Escape to close the drawer via keyboard
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });
});
