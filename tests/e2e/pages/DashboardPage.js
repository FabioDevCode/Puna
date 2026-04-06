/**
 * DashboardPage — interactions with /dashboard.
 */
import { BasePage } from './BasePage.js';

export class DashboardPage extends BasePage {
    get heading() {
        return this.page.locator('h3');
    }

    async navigate() {
        await this.goto('/dashboard');
    }

    async isVisible() {
        return this.page.url().includes('/dashboard');
    }
}
