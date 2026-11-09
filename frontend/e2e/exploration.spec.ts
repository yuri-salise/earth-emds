import { expect, test } from '@playwright/test';

test.describe('Primary User Journey & Exploration (FR-04..FR-15, NFR-01)', () => {
  test('renders 3D globe, filters hazards in < 2s, and inspects event drawer with country & news evidence', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verify Header, Freshness Timestamp & 3D Globe Canvas
    await expect(page.getByText(/EARTH EMDS/i)).toBeVisible();
    await expect(page.getByTestId('last-updated-timestamp')).toBeVisible();
    await expect(page.getByTestId('globe-canvas')).toBeVisible();

    // 2. Filter by Wildfires category and Open status within < 2000ms
    const startTime = Date.now();
    await page.getByTestId('category-filter-wildfires').click();
    await page.getByTestId('status-filter-open').click();
    await expect(page.getByTestId('event-listbox')).toBeVisible();
    expect(Date.now() - startTime).toBeLessThan(2000);

    // 3. Select an event from the sidebar list
    const firstOption = page.locator('[role="option"]').first();
    await firstOption.click();

    // 4. Verify Slide-Over Event Detail Drawer content & disclaimers
    const drawer = page.getByTestId('event-detail-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('disclaimer-satellite-geometry')).toBeVisible();
    await expect(drawer.getByTestId('disclaimer-national-density')).toBeVisible();
    await expect(drawer.getByTestId('disclaimer-contextual-news')).toBeVisible();

    // Verify National Average density label on matched country card
    await expect(drawer.getByText(/National Average \(/i).first()).toBeVisible();

    // Verify ranked news coverage and match reason chips
    await expect(drawer.getByTestId('match-reason-chip').first()).toBeVisible();

    // Verify external links enforce rel="noopener noreferrer"
    const externalLinks = drawer.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(externalLinks.nth(i)).toHaveAttribute('rel', /noopener noreferrer/);
    }

    // 5. Verify 1-Click Lite Mode toggle unmounts 3D canvas
    await page.getByTestId('lite-mode-toggle').click();
    await expect(page.getByTestId('globe-canvas')).toHaveCount(0);
    await expect(page.getByTestId('render-mode-indicator')).toContainText(/Lite Mode — GPU Off/i);
  });
});
