import { test, expect } from '@playwright/test';

test.describe('Recordings', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - in real tests, would use actual login
    // For now, assume user is logged in
    await page.goto('/recordings');
  });

  test('should display recordings list', async ({ page }) => {
    // Mock API response
    await page.route('**/api/v1/recordings', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-id',
            started_at: new Date().toISOString(),
            duration_ms: 60000,
            status: 'ready',
            source: 'discord',
            guild_name: 'Test Guild',
            channel_name: 'Test Channel',
          },
        ]),
      });
    });

    await page.goto('/recordings');
    
    await expect(page.getByText('Test Guild')).toBeVisible();
    await expect(page.getByText('Test Channel')).toBeVisible();
  });

  test('should navigate to recording player', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/recordings', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-id',
            started_at: new Date().toISOString(),
            duration_ms: 60000,
            status: 'ready',
            source: 'discord',
            guild_name: 'Test Guild',
            channel_name: 'Test Channel',
          },
        ]),
      });
    });

    await page.route('**/api/v1/recordings/test-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recording: {
            id: 'test-id',
            guild: { id: 'guild-id', name: 'Test Guild' },
            channel: { id: 'channel-id', name: 'Test Channel' },
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            duration_ms: 60000,
            status: 'ready',
          },
          participants: [],
          media: { playback: { type: 'audio', url: 'http://example.com/audio.mp3' } },
          transcript: { segments: [] },
        }),
      });
    });

    await page.goto('/recordings');
    await page.getByText('Test Guild').click();
    
    await expect(page).toHaveURL(/\/recordings\/test-id/);
    await expect(page.getByText('Test Guild')).toBeVisible();
  });
});
