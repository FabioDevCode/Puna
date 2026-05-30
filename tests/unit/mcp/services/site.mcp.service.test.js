/**
 * @file tests/unit/mcp/services/site.mcp.service.test.js
 * Unit tests for src/mcp/services/site.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpSites, getMcpSiteDetails } from '../../../../src/mcp/services/site.js';
import models from '../../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/models/index.js', () => ({
    default: {
        Site: {
            findAll: vi.fn(),
            findByPk: vi.fn(),
        },
        Form: {
            findAll: vi.fn(),
        },
        Inbox: {
            findAll: vi.fn(),
        },
        sequelize: {
            fn: vi.fn((fnName, col) => ({ fn: fnName, col })),
            col: vi.fn((c) => c),
        },
    },
}));

vi.mock('../../../../src/services/access.service.js', () => ({
    getSiteWhereCondition: vi.fn(),
    checkSiteAccess: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSiteModel(overrides = {}) {
    const data = { id: 's1', domain: 'example.com', createdAt: new Date('2026-01-01'), ...overrides };
    return { ...data, toJSON: vi.fn().mockReturnValue(data) };
}

function makeFormModel(overrides = {}) {
    const data = { id: 'f1', name: 'Contact', createdAt: new Date('2026-01-01'), ...overrides };
    return { ...data, toJSON: vi.fn().mockReturnValue(data) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcp/services/site', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getMcpSites(userId, userRole)', () => {
        it('passes getSiteWhereCondition result to findAll', async () => {
            const { getSiteWhereCondition } = await import('../../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockResolvedValue({ fk_id_user: 'u1' });
            vi.mocked(models.Site.findAll).mockResolvedValue([]);

            await getMcpSites('u1', 'owner');

            expect(vi.mocked(models.Site.findAll)).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_user: 'u1' } }));
        });

        it('uses empty where object when getSiteWhereCondition returns null (super_admin)', async () => {
            const { getSiteWhereCondition } = await import('../../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockResolvedValue(null);
            vi.mocked(models.Site.findAll).mockResolvedValue([]);

            await getMcpSites('u1', 'super_admin');

            expect(vi.mocked(models.Site.findAll)).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
        });

        it('returns serialised sites', async () => {
            const { getSiteWhereCondition } = await import('../../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockResolvedValue({});
            vi.mocked(models.Site.findAll).mockResolvedValue([makeSiteModel()]);

            const result = await getMcpSites('u1', 'owner');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('s1');
            expect(typeof result[0].toJSON).toBe('undefined');
        });

        it('returns empty array when no sites', async () => {
            const { getSiteWhereCondition } = await import('../../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockResolvedValue({});
            vi.mocked(models.Site.findAll).mockResolvedValue([]);

            const result = await getMcpSites('u1', 'owner');

            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpSiteDetails(siteId)', () => {
        it('returns null when site not found', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(null);
            vi.mocked(models.Form.findAll).mockResolvedValue([]);

            const result = await getMcpSiteDetails('s-missing');

            expect(result).toBeNull();
        });

        it('returns site with forms each enriched with total_submissions', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(makeSiteModel());
            vi.mocked(models.Form.findAll).mockResolvedValue([makeFormModel({ id: 'f1' })]);
            vi.mocked(models.Inbox.findAll).mockResolvedValue([{ fk_id_form: 'f1', total: '7' }]);

            const result = await getMcpSiteDetails('s1');

            expect(result.site.id).toBe('s1');
            expect(result.forms[0].total_submissions).toBe(7);
        });

        it('sets total_submissions to 0 when form has no submissions', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(makeSiteModel());
            vi.mocked(models.Form.findAll).mockResolvedValue([makeFormModel({ id: 'f1' })]);
            vi.mocked(models.Inbox.findAll).mockResolvedValue([]); // no counts returned

            const result = await getMcpSiteDetails('s1');

            expect(result.forms[0].total_submissions).toBe(0);
        });

        it('does not query Inbox when site has no forms', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(makeSiteModel());
            vi.mocked(models.Form.findAll).mockResolvedValue([]);

            const result = await getMcpSiteDetails('s1');

            expect(vi.mocked(models.Inbox.findAll)).not.toHaveBeenCalled();
            expect(result.forms).toEqual([]);
        });

        it('maps total_submissions per form correctly when multiple forms', async () => {
            vi.mocked(models.Site.findByPk).mockResolvedValue(makeSiteModel());
            vi.mocked(models.Form.findAll).mockResolvedValue([makeFormModel({ id: 'f1', name: 'Contact' }), makeFormModel({ id: 'f2', name: 'Newsletter' })]);
            vi.mocked(models.Inbox.findAll).mockResolvedValue([
                { fk_id_form: 'f1', total: '10' },
                { fk_id_form: 'f2', total: '3' },
            ]);

            const result = await getMcpSiteDetails('s1');

            const f1 = result.forms.find((f) => f.id === 'f1');
            const f2 = result.forms.find((f) => f.id === 'f2');
            expect(f1.total_submissions).toBe(10);
            expect(f2.total_submissions).toBe(3);
        });
    });
});
