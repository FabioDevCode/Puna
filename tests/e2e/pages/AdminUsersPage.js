/**
 * AdminUsersPage — interactions with /admin/users.
 */
import { BasePage } from './BasePage.js';

export class AdminUsersPage extends BasePage {
    async navigate() {
        await this.goto('/admin/users');
    }

    async navigateAdmin() {
        await this.goto('/admin');
    }

    get heading() {
        return this.page.locator('h3');
    }
}
