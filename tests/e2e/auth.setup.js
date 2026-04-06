/**
 * Auth setup — authenticates test users and saves their session state.
 * This runs as a "setup" project before the main test suite.
 */
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword1!E2e@';

const users = [
    { login: 'admin_e2e', file: 'admin' },
    { login: 'owner_e2e', file: 'owner' },
    { login: 'editor_e2e', file: 'editor' },
    { login: 'viewer_e2e', file: 'viewer' },
];

for (const { login, file } of users) {
    setup(`authenticate ${login}`, async ({ page }) => {
        const storageFile = path.resolve(`tests/e2e/.auth/${file}.json`);

        await page.goto('/dp-login');
        await page.locator('input[name="login"]').fill(login);
        await page.locator('input[name="password"]').fill(TEST_PASSWORD);
        await page.locator('form[action="/dp-connect"] button').click();

        // Wait for dashboard redirect
        await expect(page).toHaveURL(/\/dashboard/);

        // Save storage state (cookies + localStorage)
        await page.context().storageState({ path: storageFile });
    });
}
