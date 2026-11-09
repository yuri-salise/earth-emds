import { expect, test } from '@playwright/test';

test.describe('Upstream Outage Resilience & Secret Isolation (FR-12, NFR-03, NFR-04)', () => {
  test('renders cached fallback snapshot during upstream outage and never exposes server secrets', async ({
    page,
  }) => {
    const responsePayloads: string[] = [];

    page.on('response', async (response) => {
      try {
        if (response.url().includes('/api/v1/')) {
          const text = await response.text();
          responsePayloads.push(text);
        }
      } catch {
        // Ignore body read errors on aborted requests
      }
    });

    // Simulate degraded/offline upstream API so cached snapshot banner activates
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'degraded',
          cache_freshness: 'cached_fallback',
          last_updated_at: '2026-10-14T11:40:00Z',
          providers: {
            eonet: { outcome: 'success', last_sync_at: '2026-10-14T11:40:00Z' },
            rest_countries: { outcome: 'success', last_sync_at: '2026-10-14T11:25:00Z' },
            newsapi: { outcome: 'rate_limited', last_sync_at: '2026-10-14T10:00:00Z' },
          },
        }),
      });
    });

    await page.goto('/');

    // FreshnessBanner should be visible showing cached snapshot status
    await expect(page.getByTestId('freshness-banner')).toBeVisible();
    await expect(page.getByTestId('event-listbox')).toBeVisible();

    // Verify no response payload leaks NEWSAPI_KEY or POSTGRES_PASSWORD
    for (const body of responsePayloads) {
      expect(body).not.toContain('NEWSAPI_KEY');
      expect(body).not.toContain('POSTGRES_PASSWORD');
    }
  });
});
