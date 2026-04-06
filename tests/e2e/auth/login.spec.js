/**
 * E2E tests — Login & Logout flows.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';

const TEST_PASSWORD = 'TestPassword1!E2e@';

test.describe('Login', () => {
    test('login réussi redirige vers /dashboard', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        await loginPage.login('admin_e2e', TEST_PASSWORD);
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('login échoué avec mauvais mot de passe reste sur /dp-login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        await loginPage.login('admin_e2e', 'wrong-password');

        // Should stay on login page (redirected back)
        await expect(page).toHaveURL(/\/dp-login/);
    });

    test('login échoué avec utilisateur inexistant', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        await loginPage.login('nonexistent_user', TEST_PASSWORD);

        await expect(page).toHaveURL(/\/dp-login/);
    });

    test('accès au dashboard sans session redirige vers /dp-login', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/dp-login/);
    });
});

test.describe('Logout', () => {
    test('déconnexion redirige vers /dp-login et empêche le retour', async ({ page }) => {
        const loginPage = new LoginPage(page);

        // Login first
        await loginPage.loginAndWaitForDashboard('admin_e2e', TEST_PASSWORD);

        // Logout
        await page.goto('/dp-logout');
        await expect(page).toHaveURL(/\/dp-login/);

        // Try to access dashboard again — should redirect to login
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/dp-login/);
    });
});
