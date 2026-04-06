/**
 * SitesPage — interactions with /site/all and /site/:id/view.
 */
import { BasePage } from './BasePage.js';

export class SitesPage extends BasePage {
    /** Navigate to the sites list. */
    async navigate() {
        await this.goto('/site/all');
    }

    /** All site cards on the list page. */
    get siteCards() {
        return this.page.locator('.dash-site');
    }

    /**
     * Find a site card by domain text.
     * @param {string} domain
     */
    siteCard(domain) {
        return this.page.locator('.dash-site', { hasText: domain });
    }

    // ── Create site modal ──

    get newSiteButton() {
        return this.page.locator('#btn-new-site');
    }

    get createSiteModal() {
        return this.page.locator('#my_modal_new_site');
    }

    get domainInput() {
        return this.createSiteModal.locator('input[name="domain"]');
    }

    get createSiteSubmit() {
        return this.page.locator('#btnCreateSite');
    }

    /**
     * Open the modal, fill domain, and submit.
     * @param {string} domain
     */
    async createSite(domain) {
        await this.newSiteButton.click();
        await this.createSiteModal.waitFor({ state: 'visible' });
        await this.domainInput.fill(domain);
        await this.createSiteSubmit.click();
    }

    // ── Site detail page ──

    /** Heading with the site domain on the show page. */
    get siteHeading() {
        return this.page.locator('h3.font-inter');
    }

    /** Form tabs on the site detail page. */
    get formTabs() {
        return this.page.locator('[role="tab"]');
    }

    /** Form code display. */
    get formCode() {
        return this.page.locator('#info_form_code');
    }

    /**
     * Open the delete site modal and confirm by typing the domain.
     * @param {string} siteId
     * @param {string} domain
     */
    async deleteSite(siteId, domain) {
        // Click the delete button to open modal
        await this.page.locator(`[data-open-modal="delete_site_modal_${siteId}"]`).click();
        const modal = this.page.locator(`#delete_site_modal_${siteId}`);
        await modal.waitFor({ state: 'visible' });

        // Type the domain to confirm
        await modal.locator('input[name="confirm_domain"]').fill(domain);
        // Submit
        await modal.locator('button[type="submit"]').click();
    }
}
