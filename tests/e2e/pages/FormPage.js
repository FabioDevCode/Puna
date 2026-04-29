/* global document */
/**
 * FormPage — interactions for creating/deleting forms on a site detail page.
 */
import { BasePage } from './BasePage.js';

export class FormPage extends BasePage {
    /**
     * Navigate to a site detail page.
     * @param {string} siteId
     */
    async navigateToSite(siteId) {
        await this.goto(`/site/${siteId}/view`);
    }

    /** Form tabs. */
    get formTabs() {
        return this.page.locator('[role="tab"]');
    }

    /**
     * Find a form tab by name.
     * @param {string} name
     */
    formTab(name) {
        return this.page.locator(`[role="tab"][data-name="${name}"]`);
    }

    /**
     * Click the new form button to open the modal for the given site.
     * @param {string} siteId
     */
    async openCreateFormModal(siteId) {
        await this.page.locator(`[data-open-modal="modal_create_form_${siteId}"]`).click();
        await this.page.locator(`#modal_create_form_${siteId}`).waitFor({ state: 'visible' });
    }

    /**
     * Create a new form on the current site page.
     * @param {string} siteId
     * @param {string} formName
     */
    async createForm(siteId, formName) {
        await this.openCreateFormModal(siteId);
        const modal = this.page.locator(`#modal_create_form_${siteId}`);
        await modal.locator('input[name="name"]').fill(formName);

        // Click submit and wait for the resulting navigation
        await Promise.all([this.page.waitForURL(/\/site\/|\/dashboard/), this.page.locator(`#btnCreateForm_${siteId}`).click()]);
    }

    /**
     * Delete a form using the inline delete button.
     * The site show page exposes a form-related delete action.
     * @param {string} formId
     */
    async deleteForm(formId) {
        // The delete form action is a POST form submission
        // We need to evaluate the form submission in the page context
        await this.page.evaluate((id) => {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/form/delete';
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrf = csrfMeta ? csrfMeta.content : '';

            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            csrfInput.value = csrf;
            form.appendChild(csrfInput);

            const idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.name = 'form_id';
            idInput.value = id;
            form.appendChild(idInput);

            document.body.appendChild(form);
            form.submit();
        }, formId);
    }
}
