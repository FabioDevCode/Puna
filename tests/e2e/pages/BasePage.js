/**
 * BasePage — shared helpers for all Page Objects.
 */
export class BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /** Current URL path (without origin). */
    get currentPath() {
        return new URL(this.page.url()).pathname;
    }

    /**
     * Read flash message data attribute before Toastify consumes it.
     * Returns the parsed array or [].
     */
    async getFlashData() {
        const raw = await this.page
            .locator('#flash-messages')
            .getAttribute('data-flash-messages')
            .catch(() => '[]');
        try {
            return JSON.parse(raw || '[]');
        } catch {
            return [];
        }
    }

    /**
     * Wait for a Toastify toast to appear with the given text (substring match).
     * @param {string} text
     * @param {{ timeout?: number }} opts
     */
    async waitForToast(text, { timeout = 5000 } = {}) {
        await this.page.locator('.toastify', { hasText: text }).first().waitFor({ timeout });
    }

    /**
     * Navigate to a path relative to baseURL.
     * @param {string} path
     */
    async goto(path) {
        await this.page.goto(path);
    }
}
