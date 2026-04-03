/**
 * @file tests/unit/controllers/site.controller.test.js
 * Unit tests for createSite validation in site.controller.js.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSite } from '../../../src/controllers/site.controller.js';
import { createSite as createSiteService, domainExists } from '../../../src/services/site.service.js';

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
    default: { Site: { findOne: vi.fn() } },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptObject: vi.fn((o) => `enc:${JSON.stringify(o)}`),
    decryptObject: vi.fn(),
    encryptString: vi.fn((s) => `enc:${s}`),
}));

vi.mock('../../../src/services/site.service.js', () => ({
    createSite: vi.fn(),
    getSiteWithForms: vi.fn(),
    deleteSiteWithForms: vi.fn(),
    generateSiteToken: vi.fn(),
    revokeSiteTokens: vi.fn(),
    domainExists: vi.fn(),
    verifySiteAccess: vi.fn(),
}));

vi.mock('../../../src/services/stats.service.js', () => ({
    getSitesWithCounts: vi.fn(),
}));

describe('createSite — validation', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
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

    it('rejette un domaine vide', async () => {
        req.body.domain = '';
        await createSite(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/all');
        expect(createSiteService).not.toHaveBeenCalled();
    });

    it('rejette un domaine au format invalide', async () => {
        req.body.domain = 'not a domain';
        await createSite(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/all');
        expect(createSiteService).not.toHaveBeenCalled();
    });

    it('rejette un domaine sans TLD', async () => {
        req.body.domain = 'localhost';
        await createSite(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/all');
        expect(createSiteService).not.toHaveBeenCalled();
    });

    it('rejette un domaine déjà existant', async () => {
        req.body.domain = 'example.com';
        domainExists.mockResolvedValue(true);
        await createSite(req, res);
        expect(res.flash).toHaveBeenCalledWith('error', 'site.exists_error');
        expect(res.redirect).toHaveBeenCalledWith('/site/all');
        expect(createSiteService).not.toHaveBeenCalled();
    });

    it('crée le site avec un domaine valide et unique', async () => {
        req.body.domain = 'example.com';
        domainExists.mockResolvedValue(false);
        createSiteService.mockResolvedValue({ id: 42 });
        await createSite(req, res);
        expect(createSiteService).toHaveBeenCalledWith(expect.objectContaining({ domain: 'example.com' }), 1);
        expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/42/view');
    });
});
