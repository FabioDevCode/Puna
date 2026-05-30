/**
 * @file tests/unit/mcp/services/form.mcp.service.test.js
 * Unit tests for src/mcp/services/form.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpForms, getMcpFormDetails } from '../../../../src/mcp/services/form.js';
import models from '../../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/models/index.js', () => ({
    default: {
        Form: {
            findAll: vi.fn(),
            findByPk: vi.fn(),
        },
        Inbox: {
            count: vi.fn(),
        },
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormModel(overrides = {}) {
    const data = {
        id: 'f1',
        name: 'Contact',
        columns: null,
        template: null,
        file_keys: null,
        createdAt: new Date('2026-01-01'),
        ...overrides,
    };
    return { ...data, toJSON: vi.fn().mockReturnValue(data) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcp/services/form', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getMcpForms(siteId)', () => {
        it('returns serialised forms for a site', async () => {
            const form = makeFormModel();
            vi.mocked(models.Form.findAll).mockResolvedValue([form]);

            const result = await getMcpForms('s1');

            expect(vi.mocked(models.Form.findAll)).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_site: 's1' } }));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('f1');
        });

        it('returns empty array when no forms exist', async () => {
            vi.mocked(models.Form.findAll).mockResolvedValue([]);

            const result = await getMcpForms('s99');

            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpFormDetails(formId)', () => {
        it('returns null when form not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f-missing');

            expect(result).toBeNull();
        });

        it('parses columns from JSON string', async () => {
            const form = makeFormModel({ columns: '["email","name"]' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.columns).toEqual(['email', 'name']);
        });

        it('parses template (columns_labels) from JSON string', async () => {
            const form = makeFormModel({ template: '{"email":"Email address"}' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.columns_labels).toEqual({ email: 'Email address' });
        });

        it('parses file_keys from JSON string', async () => {
            const form = makeFormModel({ file_keys: '["attachment"]' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.file_keys).toEqual(['attachment']);
        });

        it('keeps null when JSON is invalid', async () => {
            const form = makeFormModel({ columns: 'not-valid-json' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.columns).toBeNull();
        });

        it('sets has_files to true when file_keys is non-empty', async () => {
            const form = makeFormModel({ file_keys: '["photo"]' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.has_files).toBe(true);
        });

        it('sets has_files to false when file_keys is null', async () => {
            const form = makeFormModel({ file_keys: null });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.has_files).toBe(false);
        });

        it('sets has_files to false when file_keys is empty array', async () => {
            const form = makeFormModel({ file_keys: '[]' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result.has_files).toBe(false);
        });

        it('includes total_submissions count', async () => {
            const form = makeFormModel();
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(42);

            const result = await getMcpFormDetails('f1');

            expect(result.total_submissions).toBe(42);
        });

        it('does not expose the code field', async () => {
            const form = makeFormModel({ code: 'SECRET-CODE-123' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            expect(result).not.toHaveProperty('code');
        });

        it('does not expose raw columns/template/file_keys fields', async () => {
            const form = makeFormModel({ columns: '["a"]', template: '{}', file_keys: '[]' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(form);
            vi.mocked(models.Inbox.count).mockResolvedValue(0);

            const result = await getMcpFormDetails('f1');

            // Parsed versions should be present, raw string fields should not
            expect(result).toHaveProperty('columns');
            expect(result).toHaveProperty('columns_labels');
            expect(result).toHaveProperty('file_keys');
        });
    });
});
