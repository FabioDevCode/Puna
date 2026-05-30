/**
 * @file tests/unit/mcp/services/inbox.mcp.service.test.js
 * Unit tests for src/mcp/services/inbox.js
 */

import { Op } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpSubmissions, getMcpSubmission, getMcpRecentSubmissions, getMcpSearchSubmissions } from '../../../../src/mcp/services/inbox.js';
import models from '../../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/models/index.js', () => ({
    default: {
        Inbox: {
            findAndCountAll: vi.fn(),
            findByPk: vi.fn(),
        },
        Form: {},
        Site: {},
        sequelize: {
            query: vi.fn(),
        },
        Sequelize: {
            QueryTypes: { SELECT: 'SELECT' },
        },
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(contentOverride = { name: 'Alice' }) {
    const data = {
        id: 'sub-1',
        content: JSON.stringify(contentOverride),
        createdAt: new Date('2026-05-01T10:00:00Z'),
    };
    return { ...data, toJSON: vi.fn().mockReturnValue(data) };
}

function makeRawRow(overrides = {}) {
    return {
        id: 'sub-1',
        content: JSON.stringify({ name: 'Bob' }),
        createdAt: new Date('2026-05-01T10:00:00Z'),
        form_id: 'f1',
        form_name: 'Newsletter',
        site_id: 's1',
        site_domain: 'example.com',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcp/services/inbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getMcpSubmissions(formId, page, limit, dateFrom, dateTo)', () => {
        it('returns paginated submissions with correct metadata', async () => {
            const row = makeRow();
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [row], count: 3 });

            const result = await getMcpSubmissions('form-1', 1, 2);

            expect(result.total).toBe(3);
            expect(result.totalPages).toBe(2);
            expect(result.currentPage).toBe(1);
            expect(result.submissions).toHaveLength(1);
        });

        it('parses JSON string content into object', async () => {
            const data = { id: 'sub-1', content: '{"email":"test@example.com"}', createdAt: new Date() };
            const row = { ...data, toJSON: vi.fn().mockReturnValue(data) };
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [row], count: 1 });

            const result = await getMcpSubmissions('form-1');

            expect(result.submissions[0].content).toEqual({ email: 'test@example.com' });
        });

        it('returns raw string when content is invalid JSON', async () => {
            const data = { id: 'sub-1', content: 'not-valid-json', createdAt: new Date() };
            const row = { ...data, toJSON: vi.fn().mockReturnValue(data) };
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [row], count: 1 });

            const result = await getMcpSubmissions('form-1');

            expect(result.submissions[0].content).toBe('not-valid-json');
        });

        it('returns null content when content is null', async () => {
            const data = { id: 'sub-1', content: null, createdAt: new Date() };
            const row = { ...data, toJSON: vi.fn().mockReturnValue(data) };
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [row], count: 1 });

            const result = await getMcpSubmissions('form-1');

            expect(result.submissions[0].content).toBeNull();
        });

        it('applies Op.gte when date_from is provided', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getMcpSubmissions('form-1', 1, 50, '2026-05-01', null);

            const call = vi.mocked(models.Inbox.findAndCountAll).mock.calls[0][0];
            expect(call.where.createdAt[Op.gte]).toEqual(new Date('2026-05-01'));
        });

        it('applies Op.lte at 23:59:59.999 when date_to is provided', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getMcpSubmissions('form-1', 1, 50, null, '2026-05-31');

            const call = vi.mocked(models.Inbox.findAndCountAll).mock.calls[0][0];
            const dateTo = call.where.createdAt[Op.lte];
            expect(dateTo.getHours()).toBe(23);
            expect(dateTo.getMinutes()).toBe(59);
            expect(dateTo.getSeconds()).toBe(59);
        });

        it('does not add createdAt filter when neither date is provided', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getMcpSubmissions('form-1');

            const call = vi.mocked(models.Inbox.findAndCountAll).mock.calls[0][0];
            expect(call.where.createdAt).toBeUndefined();
        });

        it('computes correct offset from page number', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getMcpSubmissions('form-1', 3, 10);

            const call = vi.mocked(models.Inbox.findAndCountAll).mock.calls[0][0];
            expect(call.offset).toBe(20);
            expect(call.limit).toBe(10);
        });

        it('returns empty submissions array when no rows', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            const result = await getMcpSubmissions('form-1');

            expect(result.submissions).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.totalPages).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpSubmission(submissionId)', () => {
        it('returns null when submission not found', async () => {
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await getMcpSubmission('sub-999');

            expect(result).toBeNull();
        });

        it('returns submission with nested form and site, content parsed', async () => {
            const data = {
                id: 'sub-1',
                content: '{"message":"hello"}',
                createdAt: new Date(),
                form: { id: 'f1', name: 'Contact', site: { id: 's1', domain: 'example.com' } },
            };
            vi.mocked(models.Inbox.findByPk).mockResolvedValue({ toJSON: vi.fn().mockReturnValue(data) });

            const result = await getMcpSubmission('sub-1');

            expect(result.content).toEqual({ message: 'hello' });
            expect(result.form.name).toBe('Contact');
            expect(result.form.site.domain).toBe('example.com');
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpRecentSubmissions(userId, userRole, limit)', () => {
        it('includes userId filter for non-admin users', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpRecentSubmissions('u1', 'owner', 10);

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).toContain('AND s.fk_id_user = :userId');
        });

        it('omits userId filter for super_admin', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpRecentSubmissions('u1', 'super_admin', 10);

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).not.toContain('AND s.fk_id_user = :userId');
        });

        it('passes limit as replacement', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpRecentSubmissions('u1', 'owner', 25);

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[0][1];
            expect(replacements.limit).toBe(25);
        });

        it('returns mapped submissions with form and site info, content parsed', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([makeRawRow()]);

            const result = await getMcpRecentSubmissions('u1', 'owner', 10);

            expect(result).toHaveLength(1);
            expect(result[0].form).toEqual({ id: 'f1', name: 'Newsletter' });
            expect(result[0].site).toEqual({ id: 's1', domain: 'example.com' });
            expect(result[0].content).toEqual({ name: 'Bob' });
        });

        it('returns empty array when no results', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpRecentSubmissions('u1', 'owner', 10);

            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpSearchSubmissions(userId, userRole, query, page, limit)', () => {
        it('wraps search term in % for LIKE', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 0 }])
                .mockResolvedValueOnce([]);

            await getMcpSearchSubmissions('u1', 'owner', 'urgent');

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[0][1];
            expect(replacements.search).toBe('%urgent%');
        });

        it('returns correct pagination metadata', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 15 }])
                .mockResolvedValueOnce([]);

            const result = await getMcpSearchSubmissions('u1', 'owner', 'test', 1, 10);

            expect(result.total).toBe(15);
            expect(result.totalPages).toBe(2);
            expect(result.currentPage).toBe(1);
        });

        it('includes userId filter for non-admin users', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 0 }])
                .mockResolvedValueOnce([]);

            await getMcpSearchSubmissions('u1', 'editor', 'hello');

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).toContain('AND s.fk_id_user = :userId');
        });

        it('omits userId filter for super_admin', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 0 }])
                .mockResolvedValueOnce([]);

            await getMcpSearchSubmissions('u1', 'super_admin', 'hello');

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).not.toContain('AND s.fk_id_user = :userId');
        });

        it('returns empty submissions array when no results', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 0 }])
                .mockResolvedValueOnce([]);

            const result = await getMcpSearchSubmissions('u1', 'owner', 'nothing');

            expect(result.submissions).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('computes correct offset from page number', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: 0 }])
                .mockResolvedValueOnce([]);

            await getMcpSearchSubmissions('u1', 'owner', 'test', 3, 10);

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[1][1];
            expect(replacements.offset).toBe(20);
        });
    });
});
