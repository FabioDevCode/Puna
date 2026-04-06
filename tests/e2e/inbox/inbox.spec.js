/**
 * E2E tests — Inbox (view & delete).
 */
import { test, expect } from '../fixtures/auth.fixture.js';
import { InboxPage } from '../pages/InboxPage.js';

test.describe('Inbox', () => {
    test.describe.configure({ mode: 'serial' });

    /** Store the inbox ID fetched from the form inbox API. */
    let inboxId;
    let _siteId;

    test("l'inbox du formulaire Contact contient des entrées", async ({ adminPage }) => {
        // Navigate to the seeded site
        await adminPage.goto('/site/all');
        await adminPage.locator('.dash-site', { hasText: 'e2e-test.dev' }).click();
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);

        _siteId = adminPage.url().match(/\/site\/([^/]+)\/view/)?.[1];

        // Get the Contact form ID from the tab
        const contactTab = adminPage.locator('[role="tab"][data-name="Contact"]');
        await expect(contactTab).toBeVisible();
        const formId = await contactTab.getAttribute('data-id');
        expect(formId).toBeTruthy();

        // Fetch inbox entries via the JSON API
        const response = await adminPage.evaluate(async (fId) => {
            const res = await fetch(`/form/${fId}/inbox?limit=10&offset=0`);
            return res.json();
        }, formId);

        expect(response.items).toBeDefined();
        expect(response.items.length).toBeGreaterThanOrEqual(2);

        // Store an inbox ID for subsequent tests
        inboxId = response.items[0].id;
    });

    test("vue détail d'un inbox", async ({ adminPage }) => {
        expect(inboxId).toBeTruthy();

        const inbox = new InboxPage(adminPage);
        await inbox.navigateToInbox(inboxId);

        // Should display the inbox content
        await expect(inbox.contentRows.first()).toBeVisible();
    });

    test("suppression d'un inbox", async ({ adminPage }) => {
        expect(inboxId).toBeTruthy();

        const inbox = new InboxPage(adminPage);
        await inbox.navigateToInbox(inboxId);

        // Delete via the modal
        await inbox.confirmDelete();

        // Should redirect back to the site page
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);
    });
});
