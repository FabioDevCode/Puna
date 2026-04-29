/* global document */
/**
 * E2E tests — RBAC access control.
 */
import { test, expect } from '../fixtures/auth.fixture.js';

test.describe("RBAC — Contrôle d'accès", () => {
    test('viewer peut accéder au dashboard', async ({ viewerPage }) => {
        await viewerPage.goto('/dashboard');
        await expect(viewerPage).toHaveURL(/\/dashboard/);
    });

    test('viewer ne peut pas accéder à /admin', async ({ viewerPage }) => {
        const response = await viewerPage.goto('/admin');
        const status = response?.status();
        // Should see 403 page (status 403 and error-code div)
        expect(status).toBe(403);
        await expect(viewerPage.locator('.error-code')).toHaveText('403');
    });

    test('editor ne peut pas accéder à /admin', async ({ editorPage }) => {
        const response = await editorPage.goto('/admin');
        const status = response?.status();
        expect(status).toBe(403);
        await expect(editorPage.locator('.error-code')).toHaveText('403');
    });

    test('admin peut accéder à /admin', async ({ adminPage }) => {
        await adminPage.goto('/admin');
        await expect(adminPage).toHaveURL(/\/admin/);
    });

    test('owner peut accéder à /admin', async ({ ownerPage }) => {
        await ownerPage.goto('/admin');
        await expect(ownerPage).toHaveURL(/\/admin/);
    });

    test('owner ne peut pas supprimer un utilisateur (POST /admin/users/delete → 403)', async ({ ownerPage }) => {
        await ownerPage.goto('/admin/users');

        const result = await ownerPage.evaluate(async () => {
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrf = csrfMeta ? csrfMeta.getAttribute('content') : '';
            const res = await fetch('/admin/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `userId=fake-id&_csrf=${encodeURIComponent(csrf)}`,
                redirect: 'follow',
            });
            return res.status;
        });

        expect(result).toBe(403);
    });

    test('owner ne peut pas accéder aux logs (GET /admin/logs → 403)', async ({ ownerPage }) => {
        const response = await ownerPage.goto('/admin/logs');
        expect(response?.status()).toBe(403);
        await expect(ownerPage.locator('.error-code')).toHaveText('403');
    });

    test('viewer ne peut pas créer de site (POST /site/create → 403)', async ({ viewerPage }) => {
        // Navigate to sites page first (to get valid session + CSRF)
        await viewerPage.goto('/site/all');

        // Use browser-native fetch which properly sends cookies (including __csrf)
        const result = await viewerPage.evaluate(async () => {
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrf = csrfMeta ? csrfMeta.getAttribute('content') : '';
            const res = await fetch('/site/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `domain=hack.test&_csrf=${encodeURIComponent(csrf)}`,
                redirect: 'follow',
            });
            const text = await res.text();
            return { status: res.status, hasErrorCode: text.includes('class="error-code"') };
        });

        // actionAccess denies viewer from creating sites → 403
        expect(result.status).toBe(403);
    });
});
