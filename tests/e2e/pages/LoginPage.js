/**
 * LoginPage — interactions with /dp-login.
 */
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
    get loginInput() {
        return this.page.locator('input[name="login"]');
    }

    get passwordInput() {
        return this.page.locator('input[name="password"]');
    }

    get submitButton() {
        return this.page.locator('form[action="/dp-connect"] button[type="submit"], form[action="/dp-connect"] button.btn-secondary');
    }

    get firstLoginLink() {
        return this.page.locator('a[href="/dp-first-connexion"]');
    }

    async navigate() {
        await this.goto('/dp-login');
    }

    /**
     * Fill credentials and submit the login form.
     * @param {string} login
     * @param {string} password
     */
    async login(login, password) {
        await this.loginInput.fill(login);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    /**
     * Perform a full login and wait for dashboard redirect.
     * @param {string} login
     * @param {string} password
     */
    async loginAndWaitForDashboard(login, password) {
        await this.navigate();
        await this.login(login, password);
        await this.page.waitForURL('**/dashboard');
    }
}
