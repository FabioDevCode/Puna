/**
 * @file tests/unit/services/inbox.service.test.js
 * Unit tests for inbox.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    getSubmissionsByForm,
    getSubmissionsForUser,
    getSubmissionById,
    createSubmission,
    deleteSubmission,
    deleteSubmissionsByForm,
    countSubmissions,
    getSubmissionsWithFiles,
    getSubmissionsByDateRange,
    searchSubmissions,
    getSubmissionsByFormWithFilters,
    getInboxForDisplay,
    deleteInboxWithFiles,
    verifyFileAccessAndGetPath,
} from '../../../src/services/inbox.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        Inbox: {
            findAndCountAll: vi.fn(),
            findByPk: vi.fn(),
            findAll: vi.fn(),
            create: vi.fn(),
            destroy: vi.fn(),
            count: vi.fn(),
        },
        Form: {},
        Site: {},
        Sequelize: {
            Op: {
                like: Symbol('like'),
                and: Symbol('and'),
                between: Symbol('between'),
                in: Symbol('in'),
                ne: Symbol('ne'),
            },
            fn: vi.fn((...args) => ({ type: 'fn', args })),
            col: vi.fn((name) => ({ type: 'col', name })),
            literal: vi.fn((expr) => ({ type: 'literal', expr })),
            where: vi.fn((col, val) => ({ type: 'where', col, val })),
        },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/access.service.js', () => ({
    getSiteWhereCondition: vi.fn(),
}));

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        unlinkSync: vi.fn(),
    },
    existsSync: vi.fn(() => false),
    unlinkSync: vi.fn(),
}));

vi.mock('../../../src/helpers/upload_utils.js', () => ({
    finalPathFor: vi.fn((site, form, filename) => ({
        dir: `/uploads/${site.domain}`,
        path: `/uploads/${site.domain}/${filename}`,
    })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSubmission(overrides = {}) {
    const data = {
        id: 'i1',
        content: '{"name":"Alice"}',
        fk_id_form: 'f1',
        createdAt: new Date('2024-01-15'),
        ...overrides,
    };
    return { ...data, toJSON: () => data, destroy: vi.fn().mockResolvedValue(undefined) };
}

function makeMockForm(overrides = {}) {
    const data = { id: 'f1', name: 'Test Form', code: 'ABC123', file_keys: null, fk_id_site: 's1', template: null, ...overrides };
    return { ...data, toJSON: () => data };
}

function makeMockSite(overrides = {}) {
    const data = { id: 's1', domain: 'example.com', control_code: 'CC', ...overrides };
    return { ...data, toJSON: () => data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inbox.service', () => {
    beforeEach(() => {
        // resetAllMocks clears both history and mock implementations to avoid state leaks
        vi.resetAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionsByForm(formId, page, limit)', () => {
        it('returns paginated submissions for a form', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [mockSub], count: 1 });

            const result = await getSubmissionsByForm('f1', 1, 50);

            expect(models.Inbox.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_form: 'f1' }, limit: 50, offset: 0 }));
            expect(result.submissions).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
            expect(result.currentPage).toBe(1);
        });

        it('calculates correct offset for page 2', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 100 });

            const result = await getSubmissionsByForm('f1', 2, 10);
            expect(models.Inbox.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 10, limit: 10 }));
            expect(result.totalPages).toBe(10);
            expect(result.currentPage).toBe(2);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionsForUser(userId, userRole, page, limit)', () => {
        it('returns paginated submissions for a user', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });

            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [mockSub], count: 1 });

            const result = await getSubmissionsForUser('u1', 'owner', 1, 50);
            expect(result.submissions).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionById(submissionId, includeForm)', () => {
        it('returns plain object when submission found', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockSub);

            const result = await getSubmissionById('i1');
            expect(result).toEqual(expect.objectContaining({ id: 'i1' }));
            expect(typeof result.toJSON).toBe('undefined');
        });

        it('returns null when submission not found', async () => {
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);
            const result = await getSubmissionById('i99');
            expect(result).toBeNull();
        });

        it('includes form when includeForm is true', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockSub);

            await getSubmissionById('i1', true);
            expect(models.Inbox.findByPk).toHaveBeenCalledWith('i1', expect.objectContaining({ include: expect.any(Array) }));
        });
    });

    // -------------------------------------------------------------------------
    describe('createSubmission(submissionData)', () => {
        it('creates submission with fk_id_form and content', async () => {
            const mockSub = makeMockSubmission({ content: JSON.stringify({ name: 'Alice' }) });
            vi.mocked(models.Inbox.create).mockResolvedValue(mockSub);

            const result = await createSubmission({ fk_id_form: 'f1', content: { name: 'Alice' } });

            expect(models.Inbox.create).toHaveBeenCalledWith({
                fk_id_form: 'f1',
                content: { name: 'Alice' },
            });
            expect(result).toEqual(expect.objectContaining({ id: 'i1' }));
        });

        it('accepts formId as alternative to fk_id_form', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.create).mockResolvedValue(mockSub);

            await createSubmission({ formId: 'f1', content: {} });
            expect(models.Inbox.create).toHaveBeenCalledWith(expect.objectContaining({ fk_id_form: 'f1' }));
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteSubmission(submissionId)', () => {
        it('returns true when submission deleted', async () => {
            vi.mocked(models.Inbox.destroy).mockResolvedValue(1);
            const result = await deleteSubmission('i1');
            expect(result).toBe(true);
        });

        it('returns false when submission not found', async () => {
            vi.mocked(models.Inbox.destroy).mockResolvedValue(0);
            const result = await deleteSubmission('i99');
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteSubmissionsByForm(formId)', () => {
        it('returns count of deleted submissions', async () => {
            vi.mocked(models.Inbox.destroy).mockResolvedValue(5);
            const result = await deleteSubmissionsByForm('f1');
            expect(models.Inbox.destroy).toHaveBeenCalledWith({ where: { fk_id_form: 'f1' } });
            expect(result).toBe(5);
        });
    });

    // -------------------------------------------------------------------------
    describe('countSubmissions(formId)', () => {
        it('counts all submissions when no formId', async () => {
            vi.mocked(models.Inbox.count).mockResolvedValue(100);
            const result = await countSubmissions();
            expect(models.Inbox.count).toHaveBeenCalledWith({ where: {} });
            expect(result).toBe(100);
        });

        it('counts submissions for a form', async () => {
            vi.mocked(models.Inbox.count).mockResolvedValue(20);
            const result = await countSubmissions('f1');
            expect(models.Inbox.count).toHaveBeenCalledWith({ where: { fk_id_form: 'f1' } });
            expect(result).toBe(20);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionsWithFiles(formId)', () => {
        it('returns submissions for all forms when no formId', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAll).mockResolvedValue([mockSub]);

            const result = await getSubmissionsWithFiles();
            expect(models.Inbox.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
            expect(result).toHaveLength(1);
        });

        it('filters by formId when provided', async () => {
            vi.mocked(models.Inbox.findAll).mockResolvedValue([]);
            await getSubmissionsWithFiles('f1');
            expect(models.Inbox.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_form: 'f1' } }));
        });
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionsByDateRange(startDate, endDate, formId)', () => {
        it('returns submissions between two dates', async () => {
            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAll).mockResolvedValue([mockSub]);

            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            const result = await getSubmissionsByDateRange(start, end);

            expect(models.Inbox.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.anything() }) }));
            expect(result).toHaveLength(1);
        });

        it('filters by formId when provided', async () => {
            vi.mocked(models.Inbox.findAll).mockResolvedValue([]);

            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            await getSubmissionsByDateRange(start, end, 'f1');

            expect(models.Inbox.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ fk_id_form: 'f1' }),
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    describe('searchSubmissions(searchQuery, formId, limit)', () => {
        it('returns submissions matching the search query', async () => {
            const mockSubs = [
                { id: 'i1', content: { name: 'Alice Smith' }, fk_id_form: 'f1', createdAt: new Date(), toJSON: () => ({ id: 'i1', content: { name: 'Alice Smith' } }) },
                { id: 'i2', content: { name: 'Bob Jones' }, fk_id_form: 'f1', createdAt: new Date(), toJSON: () => ({ id: 'i2', content: { name: 'Bob Jones' } }) },
            ];
            vi.mocked(models.Inbox.findAll).mockResolvedValue(mockSubs);

            const result = await searchSubmissions('alice');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('i1');
        });

        it('filters by formId when provided', async () => {
            vi.mocked(models.Inbox.findAll).mockResolvedValue([]);
            await searchSubmissions('test', 'f1');
            expect(models.Inbox.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_form: 'f1' } }));
        });

        it('returns empty array when no matches', async () => {
            const mockSub = { content: { name: 'Bob' }, toJSON: () => ({ content: { name: 'Bob' } }) };
            vi.mocked(models.Inbox.findAll).mockResolvedValue([mockSub]);

            const result = await searchSubmissions('XYZ_NOT_FOUND');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getSubmissionsByFormWithFilters(formId, filters, limit, offset)', () => {
        it('returns items and total with no filters', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({
                rows: [{ id: 'i1', content: '{"name":"Alice"}', createdAt: new Date('2024-01-15') }],
                count: 1,
            });

            const result = await getSubmissionsByFormWithFilters('f1', {}, 10, 0);
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('total', 1);
            expect(result.items).toHaveLength(1);
        });

        it('parses JSON content in items', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({
                rows: [{ id: 'i1', content: '{"name":"Alice"}', createdAt: new Date('2024-01-15') }],
                count: 1,
            });

            const result = await getSubmissionsByFormWithFilters('f1', {}, 10, 0);
            expect(result.items[0].content).toEqual({ name: 'Alice' });
        });

        it('handles invalid JSON content gracefully', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({
                rows: [{ id: 'i1', content: 'NOT_JSON', createdAt: new Date('2024-01-15') }],
                count: 1,
            });

            const result = await getSubmissionsByFormWithFilters('f1', {}, 10, 0);
            expect(result.items[0].content).toBeNull();
        });

        it('applies createdAt date filter', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getSubmissionsByFormWithFilters('f1', { createdAt: '2024-01-15' }, 10, 0);
            expect(models.Inbox.findAndCountAll).toHaveBeenCalled();
        });

        it('applies JSON content field filter', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getSubmissionsByFormWithFilters('f1', { name: 'Alice' }, 10, 0);
            expect(models.Inbox.findAndCountAll).toHaveBeenCalled();
        });

        it('skips empty filter values', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getSubmissionsByFormWithFilters('f1', { name: '' }, 10, 0);
            expect(models.Inbox.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_form: 'f1' } }));
        });

        it('skips unsafe key names', async () => {
            vi.mocked(models.Inbox.findAndCountAll).mockResolvedValue({ rows: [], count: 0 });

            await getSubmissionsByFormWithFilters('f1', { 'bad key!': 'value' }, 10, 0);
            expect(models.Inbox.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_form: 'f1' } }));
        });
    });

    // -------------------------------------------------------------------------
    describe('getInboxForDisplay(inboxId, userId, userRole)', () => {
        it('returns null when inbox not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await getInboxForDisplay('i99', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns null when form has no site', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockForm = { ...makeMockForm(), site: null };
            const mockInbox = makeMockSubmission();
            mockInbox.form = mockForm;
            mockInbox.form.site = null;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxForDisplay('i1', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns full display data when access granted', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = { ...makeMockForm(), site: mockSite };
            const mockInbox = makeMockSubmission({ content: '{"name":"Alice"}' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxForDisplay('i1', 'u1', 'super_admin');
            expect(result).toHaveProperty('inbox');
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('site');
            expect(result).toHaveProperty('contentObj');
            expect(result).toHaveProperty('templateObj');
            expect(result).toHaveProperty('fileKeys');
            expect(result.contentObj).toEqual({ name: 'Alice' });
        });

        it('parses template JSON and file_keys', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ template: '{"name":"Nom"}', file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"name":"Bob","photo":"img.jpg"}' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxForDisplay('i1', 'u1', 'super_admin');
            expect(result.templateObj).toEqual({ name: 'Nom' });
            expect(result.fileKeys).toEqual(['photo']);
        });

        it('handles invalid content JSON gracefully', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm();
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: 'NOT_VALID_JSON' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxForDisplay('i1', 'u1', 'super_admin');
            expect(result.contentObj).toEqual({});
        });

        it('adds siteWhereCondition to include when not null', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            await getInboxForDisplay('i1', 'u1', 'owner');
            expect(models.Inbox.findByPk).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteInboxWithFiles(inboxId, userId, userRole)', () => {
        it('returns error when inbox not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await deleteInboxWithFiles('i99', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns error when form has no site', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockForm = makeMockForm();
            mockForm.site = null;
            const mockInbox = makeMockSubmission();
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await deleteInboxWithFiles('i1', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('deletes inbox record and returns success when no file_keys', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: null });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"name":"Alice"}' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await deleteInboxWithFiles('i1', 'u1', 'super_admin');
            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockInbox.destroy).toHaveBeenCalled();
        });

        it('deletes files on disk when file_keys and files in content', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const nodeFsMod = await import('node:fs');
            vi.mocked(nodeFsMod.default.existsSync).mockReturnValue(true);

            // Ensure mock paths fall within UPLOADS_DIR to pass path traversal check
            const savedUploadsDir = process.env.UPLOADS_DIR;
            process.env.UPLOADS_DIR = '/uploads';

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"name":"Alice","photo":"img.jpg"}' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await deleteInboxWithFiles('i1', 'u1', 'super_admin');
            expect(result.success).toBe(true);
            expect(nodeFsMod.default.unlinkSync).toHaveBeenCalled();

            process.env.UPLOADS_DIR = savedUploadsDir;
        });

        it('handles invalid file_keys JSON gracefully', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: 'INVALID_JSON' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"name":"Alice"}' });
            mockInbox.form = mockForm;

            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await deleteInboxWithFiles('i1', 'u1', 'super_admin');
            // No files to delete (invalid file_keys → fileKeys=[]), inbox gets deleted anyway
            expect(result).toEqual({ success: true, message: expect.any(String) });
        });

        it('returns error on unexpected exception', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockRejectedValue(new Error('DB error'));

            const result = await deleteInboxWithFiles('i1', 'u1', 'super_admin');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });
    });

    // -------------------------------------------------------------------------
    describe('verifyFileAccessAndGetPath(inboxId, filename, userId, userRole)', () => {
        it('returns error when inbox not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await verifyFileAccessAndGetPath('i99', 'file.pdf', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns error when form has no site', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockForm = makeMockForm();
            mockForm.site = null;
            const mockInbox = makeMockSubmission();
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await verifyFileAccessAndGetPath('i1', 'file.pdf', 'u1', 'owner');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns error when file not found in submission content', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"photo":"other.jpg"}' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await verifyFileAccessAndGetPath('i1', 'missing.pdf', 'u1', 'super_admin');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns error when physical file does not exist', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            // UPLOADS_DIR must be set so path traversal check passes, then existsSync returns false
            const savedUploadsDir = process.env.UPLOADS_DIR;
            process.env.UPLOADS_DIR = '/uploads';

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"photo":"img.jpg"}' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);
            // existsSync returns undefined (falsy) after resetAllMocks → file not found on disk

            const result = await verifyFileAccessAndGetPath('i1', 'img.jpg', 'u1', 'super_admin');
            expect(result).toEqual({ success: false, error: expect.any(String) });

            process.env.UPLOADS_DIR = savedUploadsDir;
        });

        it('returns error when content JSON is invalid', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: 'INVALID_JSON' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await verifyFileAccessAndGetPath('i1', 'img.jpg', 'u1', 'super_admin');
            // With invalid JSON, contentObj = {}, so file not found in content
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('handles invalid file_keys JSON gracefully', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: 'NOT_VALID_JSON' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"photo":"img.jpg"}' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await verifyFileAccessAndGetPath('i1', 'img.jpg', 'u1', 'super_admin');
            // With invalid file_keys JSON, fileKeys = [], so file not found in content
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it('returns success with filePath when file exists', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const nodeFsMod = await import('node:fs');
            vi.mocked(nodeFsMod.default.existsSync).mockReturnValue(true);

            // Ensure mock paths fall within UPLOADS_DIR to pass path traversal check
            const savedUploadsDir = process.env.UPLOADS_DIR;
            process.env.UPLOADS_DIR = '/uploads';

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"photo":"img.jpg"}' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await verifyFileAccessAndGetPath('i1', 'img.jpg', 'u1', 'super_admin');
            expect(result.success).toBe(true);
            expect(result.filePath).toBeDefined();

            process.env.UPLOADS_DIR = savedUploadsDir;
        });

        it('returns error on unexpected exception', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockRejectedValue(new Error('DB error'));

            const result = await verifyFileAccessAndGetPath('i1', 'file.pdf', 'u1', 'super_admin');
            expect(result).toEqual({ success: false, error: expect.any(String) });
        });
    });
});
