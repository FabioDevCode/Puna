/**
 * E2E tests — Sites CRUD.
 */
import { test, expect } from '../fixtures/auth.fixture.js';
import { SitesPage } from '../pages/SitesPage.js';

test.describe('Sites', () => {
    test.describe.configure({ mode: 'serial' });

    test('affichage de la liste des sites', async ({ adminPage }) => {
        const sites = new SitesPage(adminPage);
        await sites.navigate();

        // The seeded site should be visible
        await expect(sites.siteCard('e2e-test.dev')).toBeVisible();
    });

    test("vue détail d'un site existant", async ({ adminPage }) => {
        const sites = new SitesPage(adminPage);
        await sites.navigate();

        // Click on the seeded site card
        await sites.siteCard('e2e-test.dev').click();

        // Should navigate to site detail
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);
        await expect(sites.siteHeading).toContainText('e2e-test.dev');
    });

    test("création d'un nouveau site", async ({ adminPage }) => {
        const sites = new SitesPage(adminPage);
        await sites.navigate();

        await sites.createSite('new-e2e-site.io');

        // Should redirect to the new site's detail page
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);
        await expect(sites.siteHeading).toContainText('new-e2e-site.io');

        // Go back to list and verify it's there
        await sites.navigate();
        await expect(sites.siteCard('new-e2e-site.io')).toBeVisible();
    });

    test("suppression d'un site", async ({ adminPage }) => {
        const sites = new SitesPage(adminPage);
        await sites.navigate();

        // Click on the site we just created
        await sites.siteCard('new-e2e-site.io').click();
        await expect(adminPage).toHaveURL(/\/site\/.*\/view/);

        // Get site ID from URL
        const url = adminPage.url();
        const siteId = url.match(/\/site\/([^/]+)\/view/)?.[1];
        expect(siteId).toBeTruthy();

        // Delete the site
        await sites.deleteSite(siteId, 'new-e2e-site.io');

        // Should redirect to sites list
        await expect(adminPage).toHaveURL(/\/site\/all/);

        // The site should no longer be visible
        await expect(sites.siteCard('new-e2e-site.io')).toHaveCount(0);
    });
});
