/**
 * @file tests/unit/services/export.service.test.js
 * Unit tests for export.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    getInboxWithFiles,
    collectFiles,
    createZipArchive,
    getFormDataForExport,
    generateExcelWorkbook,
    getAllSubmissionsForExport,
    generateMultiFormExcelWorkbook,
    generateFormCSV,
    generateUsersCSV,
    generateMultiFormCSV,
} from '../../../src/services/export.service.js';

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
            findByPk: vi.fn(),
            findAll: vi.fn(),
        },
        Form: {
            findByPk: vi.fn(),
        },
        Site: {},
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
    },
    existsSync: vi.fn(() => false),
}));

vi.mock('../../../src/helpers/upload_utils.js', () => ({
    finalPathFor: vi.fn((site, form, filename) => ({
        dir: `/uploads/${site.domain}`,
        path: `/uploads/${site.domain}/${filename}`,
    })),
}));

vi.mock('archiver', () => ({
    default: vi.fn(() => ({
        file: vi.fn(),
        finalize: vi.fn(),
        on: vi.fn(),
        pipe: vi.fn(),
    })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSite(overrides = {}) {
    const data = { id: 's1', domain: 'example.com', control_code: 'CC', ...overrides };
    return { ...data, toJSON: () => data };
}

function makeMockForm(overrides = {}) {
    const data = { id: 'f1', name: 'Test Form', code: 'ABC', file_keys: null, fk_id_site: 's1', ...overrides };
    return { ...data, toJSON: () => data };
}

function makeMockSubmission(overrides = {}) {
    const data = {
        id: 'i1',
        content: '{"name":"Alice","email":"alice@example.com"}',
        fk_id_form: 'f1',
        createdAt: new Date('2024-01-15'),
        ...overrides,
    };
    return { ...data, toJSON: () => data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('export.service', () => {
    beforeEach(() => {
        // resetAllMocks clears both history and mock implementations to avoid state leaks
        vi.resetAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getInboxWithFiles(inboxId, userId, userRole)', () => {
        it('returns null when inbox not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(null);

            const result = await getInboxWithFiles('i99', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns null when form has no site', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockForm = makeMockForm();
            mockForm.site = null;
            const mockInbox = makeMockSubmission();
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxWithFiles('i1', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns inbox data with files', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm();
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission();
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxWithFiles('i1', 'u1', 'super_admin');
            expect(result).toHaveProperty('inbox');
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('site');
            expect(result).toHaveProperty('contentObj');
            expect(result).toHaveProperty('fileKeys');
            expect(result).toHaveProperty('files');
        });

        it('collects files listed in file_keys', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            const nodeFsMod = await import('node:fs');
            vi.mocked(nodeFsMod.default.existsSync).mockReturnValue(true);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm({ file_keys: '["photo"]' });
            mockForm.site = mockSite;
            const mockInbox = makeMockSubmission({ content: '{"photo":"img.jpg"}' });
            mockInbox.form = mockForm;
            vi.mocked(models.Inbox.findByPk).mockResolvedValue(mockInbox);

            const result = await getInboxWithFiles('i1', 'u1', 'super_admin');
            expect(result.files).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('collectFiles(site, form, contentObj, fileKeys, finalPathFor)', () => {
        it('returns empty array when no fileKeys', () => {
            const mockFinalPathFor = vi.fn();
            const result = collectFiles({}, {}, {}, [], mockFinalPathFor);
            expect(result).toEqual([]);
        });

        it('returns empty array when file does not exist on disk', () => {
            // existsSync returns undefined (falsy) after resetAllMocks
            const mockFinalPathFor = vi.fn(() => ({ path: '/uploads/file.jpg' }));

            const result = collectFiles({ domain: 'example.com' }, { name: 'form', code: 'ABC' }, { photo: 'file.jpg' }, ['photo'], mockFinalPathFor);
            expect(result).toEqual([]);
        });

        it('returns files that exist on disk', async () => {
            const nodeFsMod = await import('node:fs');
            vi.mocked(nodeFsMod.default.existsSync).mockReturnValue(true);

            const mockFinalPathFor = vi.fn(() => ({ path: '/uploads/example.com/12345_file.jpg' }));

            const result = collectFiles({ domain: 'example.com' }, { name: 'form', code: 'ABC' }, { photo: '12345_file.jpg' }, ['photo'], mockFinalPathFor);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('file.jpg');
            expect(result[0].path).toBe('/uploads/example.com/12345_file.jpg');
        });

        it('handles array of filenames in content value', async () => {
            const nodeFsMod = await import('node:fs');
            vi.mocked(nodeFsMod.default.existsSync).mockReturnValue(true);

            const mockFinalPathFor = vi.fn((site, form, filename) => ({ path: `/uploads/${filename}` }));

            const result = collectFiles({ domain: 'example.com' }, { name: 'form', code: 'ABC' }, { docs: ['123_a.pdf', '456_b.pdf'] }, ['docs'], mockFinalPathFor);
            expect(result).toHaveLength(2);
        });
    });

    // -------------------------------------------------------------------------
    describe('createZipArchive(files)', () => {
        it('creates a zip archiver and adds files', async () => {
            const archiverMod = await import('archiver');
            const mockArchive = { file: vi.fn(), finalize: vi.fn(), on: vi.fn(), pipe: vi.fn() };
            vi.mocked(archiverMod.default).mockReturnValue(mockArchive);

            const files = [{ path: '/uploads/a.pdf', name: 'a.pdf' }];
            const archive = createZipArchive(files);

            expect(archiverMod.default).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });
            expect(mockArchive.file).toHaveBeenCalledWith('/uploads/a.pdf', { name: 'a.pdf' });
            expect(archive).toBe(mockArchive);
        });

        it('handles empty files array', async () => {
            const archiverMod = await import('archiver');
            const mockArchive = { file: vi.fn(), finalize: vi.fn(), on: vi.fn(), pipe: vi.fn() };
            vi.mocked(archiverMod.default).mockReturnValue(mockArchive);

            createZipArchive([]);
            expect(mockArchive.file).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormDataForExport(formId, userId, userRole)', () => {
        it('returns null when form not found', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);

            const result = await getFormDataForExport('f99', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns null when form has no site', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockForm = makeMockForm();
            mockForm.site = null;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await getFormDataForExport('f1', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns form, site and submissions on success', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSite = makeMockSite();
            const mockForm = makeMockForm();
            mockForm.site = mockSite;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAll).mockResolvedValue([mockSub]);

            const result = await getFormDataForExport('f1', 'u1', 'super_admin');
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('site');
            expect(result).toHaveProperty('submissions');
            expect(result.submissions).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('generateExcelWorkbook(form, submissions, customColumns)', () => {
        it('generates a workbook with submissions', async () => {
            const form = makeMockForm();
            const submissions = [
                { id: 'i1', content: '{"name":"Alice","email":"alice@example.com"}', createdAt: new Date('2024-01-15') },
                { id: 'i2', content: '{"name":"Bob","email":"bob@example.com"}', createdAt: new Date('2024-01-16') },
            ];

            const workbook = await generateExcelWorkbook(form, submissions);
            expect(workbook).toBeDefined();
            const sheet = workbook.getWorksheet('Submissions');
            expect(sheet).toBeDefined();
            // Two header row + two data rows
            expect(sheet.rowCount).toBeGreaterThanOrEqual(2);
        });

        it('generates workbook with custom columns', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"name":"Alice"}', createdAt: new Date() }];
            const customColumns = [{ key: 'name', header: 'Full Name' }];

            const workbook = await generateExcelWorkbook(form, submissions, customColumns);
            const sheet = workbook.getWorksheet('Submissions');
            expect(sheet).toBeDefined();
        });

        it('generates workbook with empty submissions', async () => {
            const form = makeMockForm();
            const workbook = await generateExcelWorkbook(form, []);
            const sheet = workbook.getWorksheet('Submissions');
            expect(sheet).toBeDefined();
            expect(sheet.rowCount).toBe(1); // Only header row
        });

        it('handles non-string content (already parsed object)', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: { name: 'Alice' }, createdAt: new Date() }];

            const workbook = await generateExcelWorkbook(form, submissions);
            expect(workbook).toBeDefined();
        });

        it('handles array and object values in content', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"tags":["a","b"],"meta":{"k":"v"}}', createdAt: new Date() }];

            const workbook = await generateExcelWorkbook(form, submissions);
            expect(workbook).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    describe('getAllSubmissionsForExport(userId, userRole)', () => {
        it('returns submissions with form and site info', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const mockSub = makeMockSubmission();
            vi.mocked(models.Inbox.findAll).mockResolvedValue([mockSub]);

            const result = await getAllSubmissionsForExport('u1', 'super_admin');
            expect(result).toHaveLength(1);
        });

        it('returns empty array when no submissions', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });

            vi.mocked(models.Inbox.findAll).mockResolvedValue([]);

            const result = await getAllSubmissionsForExport('u1', 'owner');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('generateMultiFormExcelWorkbook(submissions)', () => {
        it('generates workbook for multiple submissions across forms', async () => {
            const submissions = [
                { id: 'i1', content: '{"name":"Alice"}', form: { name: 'Form1', site: { domain: 'site1.com' } }, createdAt: new Date() },
                { id: 'i2', content: '{"name":"Bob","city":"Paris"}', form: { name: 'Form2', site: { domain: 'site2.com' } }, createdAt: new Date() },
            ];

            const workbook = await generateMultiFormExcelWorkbook(submissions);
            const sheet = workbook.getWorksheet('All Submissions');
            expect(sheet).toBeDefined();
            expect(sheet.rowCount).toBeGreaterThanOrEqual(2);
        });

        it('handles empty submissions array', async () => {
            const workbook = await generateMultiFormExcelWorkbook([]);
            const sheet = workbook.getWorksheet('All Submissions');
            expect(sheet).toBeDefined();
        });

        it('handles array and object values in content', async () => {
            const submissions = [{ id: 'i1', content: '{"files":["a.pdf","b.pdf"],"meta":{"key":"val"}}', form: { name: 'F1', site: { domain: 'd.com' } }, createdAt: new Date() }];

            const workbook = await generateMultiFormExcelWorkbook(submissions);
            expect(workbook).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    describe('generateFormCSV(form, submissions, customColumns)', () => {
        it('generates valid CSV string for submissions', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"name":"Alice","email":"alice@example.com"}', createdAt: new Date('2024-01-15') }];

            const csv = await generateFormCSV(form, submissions);
            expect(typeof csv).toBe('string');
            expect(csv).toContain('Alice');
            expect(csv).toContain('alice@example.com');
        });

        it('generates CSV with custom columns', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"name":"Alice"}', createdAt: new Date() }];
            const customColumns = [{ key: 'name', header: 'Full Name' }];

            const csv = await generateFormCSV(form, submissions, customColumns);
            expect(csv).toContain('Full Name');
            expect(csv).toContain('Alice');
        });

        it('generates CSV for empty submissions', async () => {
            const form = makeMockForm();
            const csv = await generateFormCSV(form, []);
            expect(typeof csv).toBe('string');
        });

        it('handles array and object values by stringifying them', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"tags":["a","b"],"meta":{"k":"v"}}', createdAt: new Date() }];

            const csv = await generateFormCSV(form, submissions);
            expect(csv).toContain('a, b');
        });

        it('uses empty string for missing values', async () => {
            const form = makeMockForm();
            const submissions = [{ id: 'i1', content: '{"name":"Alice"}', createdAt: new Date() }];
            const customColumns = [
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
            ];

            const csv = await generateFormCSV(form, submissions, customColumns);
            expect(csv).toContain('Alice');
        });
    });

    // -------------------------------------------------------------------------
    describe('generateUsersCSV(users, labels)', () => {
        it('generates CSV with default labels', async () => {
            const users = [
                {
                    email: 'alice@example.com',
                    login: 'alice',
                    role: 'owner',
                    enabled: true,
                    last_connection: new Date('2024-01-10'),
                    createdAt: new Date('2024-01-01'),
                    creator: null,
                },
            ];

            const csv = await generateUsersCSV(users);
            expect(typeof csv).toBe('string');
            expect(csv).toContain('alice@example.com');
            expect(csv).toContain('alice');
        });

        it('generates CSV with custom labels', async () => {
            const users = [
                { email: 'bob@example.com', login: 'bob', role: 'viewer', enabled: false, last_connection: null, createdAt: new Date('2024-01-01'), creator: { login: 'admin' } },
            ];
            const labels = {
                email: 'Courriel',
                login: 'Identifiant',
                role: 'Rôle',
                created_by: 'Créé par',
                enabled: 'Actif',
                last_connection: 'Dernière cnx',
                created_at: 'Créé le',
                yes: 'Oui',
                no: 'Non',
            };

            const csv = await generateUsersCSV(users, labels);
            expect(csv).toContain('Courriel');
            expect(csv).toContain('bob@example.com');
        });

        it('handles user without creator', async () => {
            const users = [{ email: 'x@x.com', login: 'x', role: 'viewer', enabled: true, last_connection: null, createdAt: new Date(), creator: null }];

            const csv = await generateUsersCSV(users);
            expect(csv).toContain('N/A');
        });

        it('generates CSV for empty users array', async () => {
            const csv = await generateUsersCSV([]);
            expect(typeof csv).toBe('string');
        });
    });

    // -------------------------------------------------------------------------
    describe('generateMultiFormCSV(submissions)', () => {
        it('generates valid CSV with site, form and content fields', async () => {
            const submissions = [
                { id: 'i1', content: '{"name":"Alice"}', form: { name: 'Form1', site: { domain: 'site1.com' } }, createdAt: new Date('2024-01-15') },
                { id: 'i2', content: '{"name":"Bob"}', form: { name: 'Form2', site: { domain: 'site2.com' } }, createdAt: new Date('2024-01-16') },
            ];

            const csv = await generateMultiFormCSV(submissions);
            expect(typeof csv).toBe('string');
            expect(csv).toContain('Alice');
            expect(csv).toContain('site1.com');
            expect(csv).toContain('Form1');
        });

        it('handles missing form/site gracefully', async () => {
            const submissions = [{ id: 'i1', content: '{"name":"Alice"}', form: null, createdAt: new Date() }];

            const csv = await generateMultiFormCSV(submissions);
            expect(typeof csv).toBe('string');
        });

        it('generates CSV for empty submissions', async () => {
            const csv = await generateMultiFormCSV([]);
            expect(typeof csv).toBe('string');
        });

        it('handles array and object values in content', async () => {
            const submissions = [{ id: 'i1', content: '{"files":["a.pdf","b.pdf"],"meta":{"k":"v"}}', form: { name: 'F', site: { domain: 'd.com' } }, createdAt: new Date() }];

            const csv = await generateMultiFormCSV(submissions);
            expect(csv).toContain('a.pdf, b.pdf');
        });
    });
});
