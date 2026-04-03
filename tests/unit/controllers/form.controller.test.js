/**
 * @file tests/unit/controllers/form.controller.test.js
 * Unit tests for createForm validation in form.controller.js.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createForm } from '../../../src/controllers/form.controller.js';
import { createForm as createFormService } from '../../../src/services/form.service.js';
import { verifySiteAccess } from '../../../src/services/site.service.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: { Form: { findOne: vi.fn() } },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptObject: vi.fn((o) => `enc:${JSON.stringify(o)}`),
    decryptObject: vi.fn(),
    encryptString: vi.fn((s) => `enc:${s}`),
}));

vi.mock('../../../src/services/form.service.js', () => ({
    createForm: vi.fn(),
    deleteForm: vi.fn(),
    verifyFormAccess: vi.fn(),
    updateForm: vi.fn(),
}));

vi.mock('../../../src/services/inbox.service.js', () => ({
    getSubmissionsByFormWithFilters: vi.fn(),
}));

vi.mock('../../../src/services/site.service.js', () => ({
    verifySiteAccess: vi.fn(),
    createSite: vi.fn(),
    getSiteWithForms: vi.fn(),
    deleteSiteWithForms: vi.fn(),
    generateSiteToken: vi.fn(),
    revokeSiteTokens: vi.fn(),
    domainExists: vi.fn(),
}));

describe('createForm — validation', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: { fk_id_site: 5 },
            session: { user: { id: 1 } },
            userRole: 'owner',
            __: vi.fn((key) => key),
        };
        res = {
            flash: vi.fn(),
            redirect: vi.fn(),
            __: vi.fn((key) => key),
        };
        vi.clearAllMocks();
    });

    it('rejette un nom vide', async () => {
        req.body.name = '';
        await createForm(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/5/view');
        expect(createFormService).not.toHaveBeenCalled();
    });

    it('rejette null comme nom', async () => {
        req.body.name = null;
        await createForm(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/5/view');
        expect(createFormService).not.toHaveBeenCalled();
    });

    it('rejette un nom avec des caractères interdits (<script>)', async () => {
        req.body.name = 'form<script>';
        await createForm(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/5/view');
        expect(createFormService).not.toHaveBeenCalled();
    });

    it('crée le formulaire avec un nom valide (et le trim)', async () => {
        req.body.name = '  Contact  ';
        verifySiteAccess.mockResolvedValue({ id: 5 });
        createFormService.mockResolvedValue({});
        await createForm(req, res);
        expect(createFormService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Contact', fk_id_site: 5 }));
        expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/5/view?f=Contact');
    });

    it('redirige vers /dashboard si accès au site refusé', async () => {
        req.body.name = 'MonFormulaire';
        verifySiteAccess.mockResolvedValue(null);
        await createForm(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', 'flash.access_denied');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});
