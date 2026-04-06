/**
 * FirstLoginPage — interactions with /dp-first-connexion.
 */
import { BasePage } from './BasePage.js';

export class FirstLoginPage extends BasePage {
    get loginInput() {
        return this.page.locator('input[name="login"]');
    }

    get passwordInput() {
        return this.page.locator('input[name="password"]');
    }

    get confirmPasswordInput() {
        return this.page.locator('input[name="confirm_password"]');
    }

    get submitButton() {
        return this.page.locator('form[action="/dp-first-co"] button[type="submit"], form[action="/dp-first-co"] button[data-pwd-submit]');
    }

    get errorAlert() {
        return this.page.locator('.alert-error');
    }

    get passwordErrors() {
        return this.page.locator('.text-error li');
    }

    async navigate() {
        await this.goto('/dp-first-connexion');
    }

    /**
     * Fill and submit the first-login form.
     * @param {string} login
     * @param {string} password
     * @param {string} confirmPassword
     */
    async activate(login, password, confirmPassword) {
        await this.loginInput.fill(login);
        await this.passwordInput.fill(password);
        await this.confirmPasswordInput.fill(confirmPassword);
        await this.submitButton.click();
    }
}
