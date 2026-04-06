/**
 * E2E tests — Forms CRUD.
 */
import { test, expect } from '../fixtures/auth.fixture.js';
import { FormPage } from '../pages/FormPage.js';
import { SitesPage } from '../pages/SitesPage.js';

test.describe('Formulaires', () => {
    test.describe.configure({ mode: 'serial' });

    /** Site ID extracted from the seeded site. */
    let siteId;

    test("accès au site de test et récupération de l'ID", async ({ adminPage }) => {
        const sites = new SitesPage(adminPage);
        await sites.navigate();
        await sites.siteCard('e2e-test.dev').click();
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);

        siteId = adminPage.url().match(/\/site\/([^/]+)\/view/)?.[1];
        expect(siteId).toBeTruthy();

        // The seeded "Contact" form should be visible
        const formPage = new FormPage(adminPage);
        await expect(formPage.formTab('Contact')).toBeVisible();
    });

    test("création d'un formulaire", async ({ adminPage }) => {
        const formPage = new FormPage(adminPage);
        await formPage.navigateToSite(siteId);

        await formPage.createForm(siteId, 'Newsletter');

        // Should redirect to the same site page
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);

        // The new form tab should be visible
        await expect(formPage.formTab('Newsletter')).toBeVisible();
    });

    test("suppression d'un formulaire", async ({ adminPage }) => {
        const formPage = new FormPage(adminPage);
        await formPage.navigateToSite(siteId);

        // Find the Newsletter form tab and get its ID
        const newsletterTab = formPage.formTab('Newsletter');
        await expect(newsletterTab).toBeVisible();
        const formId = await newsletterTab.getAttribute('data-id');
        expect(formId).toBeTruthy();

        // Delete the form via programmatic POST
        await formPage.deleteForm(formId);

        // Wait for redirect
        await adminPage.waitForURL(/\/site\/.*\/view/);

        // Newsletter tab should be gone
        await expect(formPage.formTab('Newsletter')).toHaveCount(0);

        // Contact form should still exist
        await expect(formPage.formTab('Contact')).toBeVisible();
    });
});
