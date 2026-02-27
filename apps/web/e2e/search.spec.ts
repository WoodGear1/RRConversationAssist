import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('should perform search and display results', async ({ page }) => {
    // Mock search API
    await page.route('**/api/v1/search?q=*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              recording_id: 'test-id',
              start_ms: 1000,
              end_ms: 5000,
              snippet: 'Test snippet',
              score: 0.95,
              link: '/recordings/test-id?time=1000',
              play_url: '/api/media/test-id?start_ms=1000&end_ms=5000',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/search');
    
    await page.getByPlaceholder(/поиск/i).fill('test query');
    await page.getByRole('button', { name: /найти/i }).click();
    
    await expect(page.getByText('Test snippet')).toBeVisible();
  });
});
