/**
 * Auth fixture — provides pre-authenticated pages via storageState.
 */
import path from 'node:path';
import { test as base } from '@playwright/test';

export const test = base.extend({
    /** A page already authenticated as super_admin. */
    adminPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: path.resolve('tests/e2e/.auth/admin.json'),
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },

    /** A page already authenticated as owner. */
    ownerPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: path.resolve('tests/e2e/.auth/owner.json'),
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },

    /** A page already authenticated as editor. */
    editorPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: path.resolve('tests/e2e/.auth/editor.json'),
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },

    /** A page already authenticated as viewer. */
    viewerPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: path.resolve('tests/e2e/.auth/viewer.json'),
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },
});

export { expect } from '@playwright/test';
