/**
 * @file tests/integration/routes/userView.test.js
 * Integration tests for GET /admin/users/:id/view — rendered HTML
 *
 * Tests cover button visibility in #status_btn_box based on:
 *   - user.status (pending, active, inactive, suspended, banned, anonymized)
 *   - connected user role (super_admin, owner)
 *
 * Assertions use specific HTML attributes rather than button labels, because
 * modal templates (ban-user, delete-user) always appear in the page and
 * contain similar text regardless of status or role:
 *   - Ban trigger button  → id="banUserBtn"
 *   - Deactivate form     → value="inactive"
 *   - Reactivate form     → value="active"
 *   - Anonymize form      → value="anonymized"
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { create } from 'express-handlebars';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import hbs_fn from '../../../src/helpers/hbs_fn.js';

vi.mock('i18n', () => ({
    default: { __: (s) => s, __n: (s) => s },
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../../../src');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let hbs;

beforeAll(() => {
    hbs = create({
        extname: '.hbs',
        helpers: hbs_fn,
        partialsDir: path.join(srcDir, 'views/partials'),
    });
});

/**
 * Render view.hbs with the given user status and connected role,
 * returning the rendered HTML string.
 */
async function renderView(userStatus, connectedRole) {
    return hbs.render(
        path.join(srcDir, 'views/pages/admin/users/view.hbs'),
        {
            user: {
                id: 'test-user-id',
                login: 'testuser',
                email: 'test@test.com',
                role: 'editor',
                status: userStatus,
                createdAt: '2024-01-01',
                siteassignments: [],
            },
            connectedUser: { id: 'admin-id', role: connectedRole },
            csrfToken: 'test-csrf-token',
        },
        { layout: false }
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('user view — status buttons', () => {
    describe('pending status', () => {
        it('super_admin sees ban button and anonymize form', async () => {
            const html = await renderView('pending', 'super_admin');
            expect(html).toContain('id="banUserBtn"');
            expect(html).toContain('value="anonymized"');
        });

        it('super_admin does not see deactivate or reactivate forms', async () => {
            const html = await renderView('pending', 'super_admin');
            expect(html).not.toContain('value="inactive"');
            expect(html).not.toContain('value="active"');
        });

        it('owner sees no status action forms (pending restricted to super_admin)', async () => {
            const html = await renderView('pending', 'owner');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });
    });

    describe('active status', () => {
        it('super_admin sees deactivate, ban button and anonymize forms', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('value="inactive"');
            expect(html).toContain('id="banUserBtn"');
            expect(html).toContain('value="anonymized"');
        });

        it('owner sees deactivate form but not ban button or anonymize form', async () => {
            const html = await renderView('active', 'owner');
            expect(html).toContain('value="inactive"');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });

        it('deactivate form posts status=inactive', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('value="inactive"');
        });
    });

    describe('inactive status', () => {
        it('super_admin sees reactivate, ban button and anonymize forms', async () => {
            const html = await renderView('inactive', 'super_admin');
            expect(html).toContain('value="active"');
            expect(html).toContain('id="banUserBtn"');
            expect(html).toContain('value="anonymized"');
        });

        it('owner sees reactivate form but not ban button or anonymize form', async () => {
            const html = await renderView('inactive', 'owner');
            expect(html).toContain('value="active"');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });

        it('reactivate form posts status=active', async () => {
            const html = await renderView('inactive', 'super_admin');
            expect(html).toContain('value="active"');
        });
    });

    describe('suspended status', () => {
        it('super_admin sees reactivate, ban button and anonymize forms', async () => {
            const html = await renderView('suspended', 'super_admin');
            expect(html).toContain('value="active"');
            expect(html).toContain('id="banUserBtn"');
            expect(html).toContain('value="anonymized"');
        });

        it('owner sees no status action forms (suspended restricted to super_admin)', async () => {
            const html = await renderView('suspended', 'owner');
            expect(html).not.toContain('value="active"');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });
    });

    describe('banned status', () => {
        it('super_admin sees reactivate and anonymize forms but no ban button', async () => {
            const html = await renderView('banned', 'super_admin');
            expect(html).toContain('value="active"');
            expect(html).toContain('value="anonymized"');
            expect(html).not.toContain('id="banUserBtn"');
        });

        it('owner sees no status action forms (banned restricted to super_admin)', async () => {
            const html = await renderView('banned', 'owner');
            expect(html).not.toContain('value="active"');
            expect(html).not.toContain('value="anonymized"');
        });
    });

    describe('anonymized status', () => {
        it('super_admin sees no status action forms', async () => {
            const html = await renderView('anonymized', 'super_admin');
            expect(html).not.toContain('value="inactive"');
            expect(html).not.toContain('value="active"');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });

        it('owner sees no status action forms', async () => {
            const html = await renderView('anonymized', 'owner');
            expect(html).not.toContain('value="inactive"');
            expect(html).not.toContain('value="active"');
            expect(html).not.toContain('id="banUserBtn"');
            expect(html).not.toContain('value="anonymized"');
        });
    });

    describe('form actions', () => {
        it('status forms target /admin/users/:id/status', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('action="/admin/users/test-user-id/status"');
        });

        it('ban button has data-user-id and data-user-login', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('data-user-id="test-user-id"');
            expect(html).toContain('data-user-login="testuser"');
        });

        it('anonymize form posts status=anonymized', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('value="anonymized"');
        });
    });

    describe('ban modal', () => {
        it('ban-user modal is included in the page', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('modal_ban_user');
        });

        it('ban modal contains a reason textarea', async () => {
            const html = await renderView('active', 'super_admin');
            expect(html).toContain('name="reason"');
        });
    });
});
