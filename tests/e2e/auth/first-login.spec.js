/**
 * E2E tests — First login (account activation).
 *
 * ⚠️ These tests modify the pending_e2e user state.
 *    They run in serial order within this file.
 */
import { test, expect } from '@playwright/test';
import { FirstLoginPage } from '../pages/FirstLoginPage.js';

const STRONG_PASSWORD = 'NewStrongP@ssw0rd!';

test.describe('First Login', () => {
    test.describe.configure({ mode: 'serial' });

    test('activation échouée — mots de passe différents → bouton désactivé', async ({ page }) => {
        const firstLogin = new FirstLoginPage(page);
        await firstLogin.navigate();

        // Fill with strong password but mismatched confirm
        await firstLogin.loginInput.fill('pending_e2e');
        await firstLogin.passwordInput.fill(STRONG_PASSWORD);
        await firstLogin.confirmPasswordInput.fill('DifferentPassword1!');

        // The submit button should stay disabled (client-side validation)
        await expect(firstLogin.submitButton).toBeDisabled();
        // User stays on the same page
        await expect(page).toHaveURL(/\/dp-first-co|\/dp-first-connexion/);
    });

    test('activation échouée — mot de passe trop faible → bouton désactivé', async ({ page }) => {
        const firstLogin = new FirstLoginPage(page);
        await firstLogin.navigate();

        // Fill with weak matching passwords
        await firstLogin.loginInput.fill('pending_e2e');
        await firstLogin.passwordInput.fill('weak');
        await firstLogin.confirmPasswordInput.fill('weak');

        // The submit button should stay disabled (password rules not met)
        await expect(firstLogin.submitButton).toBeDisabled();
        await expect(page).toHaveURL(/\/dp-first-co|\/dp-first-connexion/);
    });

    test('activation réussie du compte pending_e2e', async ({ page }) => {
        const firstLogin = new FirstLoginPage(page);
        await firstLogin.navigate();

        await firstLogin.activate('pending_e2e', STRONG_PASSWORD, STRONG_PASSWORD);

        // Should redirect to login page
        await expect(page).toHaveURL(/\/dp-login/);
    });
});
