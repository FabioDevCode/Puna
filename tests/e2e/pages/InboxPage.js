/**
 * InboxPage — interactions with /inbox/:id/view and inbox list on site detail page.
 */
import { BasePage } from './BasePage.js';

export class InboxPage extends BasePage {
    /**
     * Navigate to inbox detail page.
     * @param {string} inboxId
     */
    async navigateToInbox(inboxId) {
        await this.goto(`/inbox/${inboxId}/view`);
    }

    /** Inbox heading (#<id>). */
    get inboxHeading() {
        return this.page.locator('h3.font-inter');
    }

    /** Content table rows on the inbox show page. */
    get contentRows() {
        return this.page.locator('table tbody tr');
    }

    /** Delete button on the inbox show page. */
    get deleteButton() {
        return this.page.locator('#btn_delete_inbox_show');
    }

    /** Confirm delete in the modal. */
    async confirmDelete() {
        await this.deleteButton.click();
        const modal = this.page.locator('#modal_delete_inbox_show');
        await modal.waitFor({ state: 'visible' });
        await modal.locator('button[type="submit"]').click();
    }
}
