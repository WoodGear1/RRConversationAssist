import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page).toHaveTitle(/RRConversationAssist/);
    await expect(page.getByText('Войти через Discord')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Пароль')).toBeVisible();
  });

  test('should require terms acceptance for credentials login', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Пароль').fill('password123');
    
    // Try to submit without accepting terms
    await page.getByRole('button', { name: 'Войти' }).click();
    
    // Should show error about terms
    await expect(page.getByText(/Необходимо принять условия/)).toBeVisible();
  });

  test('should allow login after accepting terms', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Пароль').fill('password123');
    await page.getByLabel(/Я принимаю/).check();
    
    // Note: This would need actual auth setup for full E2E
    // For now, just check that form is submittable
    const submitButton = page.getByRole('button', { name: 'Войти' });
    await expect(submitButton).toBeEnabled();
  });
});
