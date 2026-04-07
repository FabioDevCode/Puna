/**
 * @file tests/unit/services/form.service.test.js
 * Unit tests for form.service.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import models from '../../../src/models/index.js';
import {
    getFormsBySite,
    getFormsForUser,
    getFormById,
    getFormByEndpoint,
    createForm,
    updateForm,
    deleteForm,
    endpointExists,
    countForms,
    getFormTemplates,
    verifyFormAccess,
} from '../../../src/services/form.service.js';

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
        Form: {
            findAll: vi.fn(),
            findByPk: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            destroy: vi.fn(),
            count: vi.fn(),
        },
        Site: {
            findOne: vi.fn(),
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

vi.mock('fs/promises', () => ({
    default: {
        rm: vi.fn().mockResolvedValue(undefined),
    },
    rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/string.js', () => ({
    default: {
        generateCode: vi.fn(() => 'GENERATED10'),
        capitalizeFirstLetter: vi.fn((s) => s),
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockForm(overrides = {}) {
    const data = {
        id: 'f1',
        name: 'Test Form',
        endpoint: '/test',
        template: null,
        columns: null,
        fk_id_site: 's1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides,
    };
    return { ...data, toJSON: () => data, update: vi.fn().mockResolvedValue(data) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('form.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getFormsBySite(siteId)', () => {
        it('returns plain objects for forms in a site', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findAll).mockResolvedValue([mockForm]);

            const result = await getFormsBySite('s1');

            expect(models.Form.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { fk_id_site: 's1' } }));
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expect.objectContaining({ id: 'f1' }));
            // Verify plain object (no toJSON method)
            expect(typeof result[0].toJSON).toBe('undefined');
        });

        it('returns empty array when no forms', async () => {
            vi.mocked(models.Form.findAll).mockResolvedValue([]);
            const result = await getFormsBySite('s99');
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormsForUser(userId, userRole)', () => {
        it('returns forms accessible for user', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });

            const mockForm = makeMockForm();
            vi.mocked(models.Form.findAll).mockResolvedValue([mockForm]);

            const result = await getFormsForUser('u1', 'owner');
            expect(result).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormById(formId, includeSite)', () => {
        it('returns plain object when form found', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await getFormById('f1');
            expect(result).toEqual(expect.objectContaining({ id: 'f1' }));
        });

        it('returns null when form not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);
            const result = await getFormById('f99');
            expect(result).toBeNull();
        });

        it('includes site when includeSite is true', async () => {
            const mockForm = makeMockForm({ site: { id: 's1', domain: 'example.com' } });
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await getFormById('f1', true);
            expect(models.Form.findByPk).toHaveBeenCalledWith('f1', expect.objectContaining({ include: expect.any(Array) }));
            expect(result).not.toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormByEndpoint(endpoint, includeSite)', () => {
        it('returns plain object when form found by endpoint', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findOne).mockResolvedValue(mockForm);

            const result = await getFormByEndpoint('/test');
            expect(result).toEqual(expect.objectContaining({ endpoint: '/test' }));
        });

        it('returns null when endpoint not found', async () => {
            vi.mocked(models.Form.findOne).mockResolvedValue(null);
            const result = await getFormByEndpoint('/missing');
            expect(result).toBeNull();
        });

        it('includes site when includeSite is true', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findOne).mockResolvedValue(mockForm);

            await getFormByEndpoint('/test', true);
            expect(models.Form.findOne).toHaveBeenCalledWith(expect.objectContaining({ include: expect.any(Array) }));
        });
    });

    // -------------------------------------------------------------------------
    describe('createForm(formData)', () => {
        it('creates a form with auto-generated code and returns plain object', async () => {
            const mockForm = makeMockForm({ code: 'GENERATED10' });
            vi.mocked(models.Form.create).mockResolvedValue(mockForm);

            const result = await createForm({ fk_id_site: 's1', name: 'My Form' });

            expect(models.Form.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'GENERATED10', name: 'My Form', fk_id_site: 's1' }));
            expect(result).toEqual(expect.objectContaining({ id: 'f1' }));
        });

        it('uses provided code if given', async () => {
            const mockForm = makeMockForm({ code: 'MYCODE123' });
            vi.mocked(models.Form.create).mockResolvedValue(mockForm);

            await createForm({ fk_id_site: 's1', name: 'My Form', code: 'MYCODE123' });

            expect(models.Form.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'MYCODE123' }));
        });

        it('stringifies template object before saving', async () => {
            const mockForm = makeMockForm({ template: '{"field":"value"}' });
            vi.mocked(models.Form.create).mockResolvedValue(mockForm);

            await createForm({ fk_id_site: 's1', name: 'Form', template: { field: 'value' } });

            expect(models.Form.create).toHaveBeenCalledWith(expect.objectContaining({ template: '{"field":"value"}' }));
        });

        it('stringifies columns object before saving', async () => {
            const mockForm = makeMockForm({ columns: '[{"key":"name"}]' });
            vi.mocked(models.Form.create).mockResolvedValue(mockForm);

            await createForm({ fk_id_site: 's1', name: 'Form', columns: [{ key: 'name' }] });

            expect(models.Form.create).toHaveBeenCalledWith(expect.objectContaining({ columns: '[{"key":"name"}]' }));
        });

        it('accepts siteId as alternative to fk_id_site', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.create).mockResolvedValue(mockForm);

            await createForm({ siteId: 's1', name: 'Form' });

            expect(models.Form.create).toHaveBeenCalledWith(expect.objectContaining({ fk_id_site: 's1' }));
        });
    });

    // -------------------------------------------------------------------------
    describe('updateForm(formId, updateData)', () => {
        it('returns null when form not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);
            const result = await updateForm('f99', { name: 'New Name' });
            expect(result).toBeNull();
        });

        it('updates the form and returns plain object', async () => {
            const mockForm = makeMockForm({ name: 'Updated' });
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await updateForm('f1', { name: 'Updated' });
            expect(mockForm.update).toHaveBeenCalledWith({ name: 'Updated' });
            expect(result).toEqual(expect.objectContaining({ id: 'f1' }));
        });

        it('stringifies template object in updateData', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            await updateForm('f1', { template: { field: 'value' } });
            expect(mockForm.update).toHaveBeenCalledWith({ template: '{"field":"value"}' });
        });

        it('stringifies columns object in updateData', async () => {
            const mockForm = makeMockForm();
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            await updateForm('f1', { columns: [{ key: 'col1' }] });
            expect(mockForm.update).toHaveBeenCalledWith({ columns: '[{"key":"col1"}]' });
        });
    });

    // -------------------------------------------------------------------------
    describe('deleteForm(formId)', () => {
        it('returns true when form deleted successfully', async () => {
            const siteData = { domain: 'example.com' };
            const mockForm = makeMockForm({
                site: { toJSON: () => siteData, ...siteData },
            });
            mockForm.site = siteData;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);
            vi.mocked(models.Form.destroy).mockResolvedValue(1);

            const result = await deleteForm('f1');
            expect(result).toBe(true);
        });

        it('returns false when form not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);
            vi.mocked(models.Form.destroy).mockResolvedValue(0);

            const result = await deleteForm('f99');
            expect(result).toBe(false);
        });

        it('still deletes DB record when form has no site', async () => {
            const mockForm = makeMockForm({ site: null });
            mockForm.site = null;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);
            vi.mocked(models.Form.destroy).mockResolvedValue(1);

            const result = await deleteForm('f1');
            expect(result).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    describe('endpointExists(endpoint, excludeFormId)', () => {
        it('returns true when endpoint exists', async () => {
            vi.mocked(models.Form.findOne).mockResolvedValue({ id: 'f1' });
            const result = await endpointExists('/test');
            expect(result).toBe(true);
        });

        it('returns false when endpoint does not exist', async () => {
            vi.mocked(models.Form.findOne).mockResolvedValue(null);
            const result = await endpointExists('/missing');
            expect(result).toBe(false);
        });

        it('excludes a specific form id when checking', async () => {
            vi.mocked(models.Form.findOne).mockResolvedValue(null);

            await endpointExists('/test', 'f1');

            expect(models.Form.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ endpoint: '/test', id: expect.anything() }) }));
        });
    });

    // -------------------------------------------------------------------------
    describe('countForms(siteId)', () => {
        it('counts all forms when no siteId provided', async () => {
            vi.mocked(models.Form.count).mockResolvedValue(10);

            const result = await countForms();
            expect(models.Form.count).toHaveBeenCalledWith({ where: {} });
            expect(result).toBe(10);
        });

        it('counts forms filtered by siteId', async () => {
            vi.mocked(models.Form.count).mockResolvedValue(3);

            const result = await countForms('s1');
            expect(models.Form.count).toHaveBeenCalledWith({ where: { fk_id_site: 's1' } });
            expect(result).toBe(3);
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormTemplates()', () => {
        it('returns forms that have a template', async () => {
            const mockForm = makeMockForm({ template: '{"field":"value"}' });
            vi.mocked(models.Form.findAll).mockResolvedValue([mockForm]);

            const result = await getFormTemplates();
            expect(result).toHaveLength(1);
        });

        it('returns empty array when no templates exist', async () => {
            vi.mocked(models.Form.findAll).mockResolvedValue([]);
            const result = await getFormTemplates();
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('verifyFormAccess(formId, userId, userRole)', () => {
        it('returns null when form not found', async () => {
            vi.mocked(models.Form.findByPk).mockResolvedValue(null);

            const result = await verifyFormAccess('f99', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns null when form has no site', async () => {
            const mockForm = makeMockForm({ site: null });
            mockForm.site = null;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await verifyFormAccess('f1', 'u1', 'owner');
            expect(result).toBeNull();
        });

        it('returns { form, site } for super_admin (null siteWhereCondition)', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue(null);

            const siteData = { id: 's1', domain: 'example.com', toJSON: () => ({ id: 's1', domain: 'example.com' }) };
            const mockForm = makeMockForm();
            mockForm.site = siteData;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);

            const result = await verifyFormAccess('f1', 'u1', 'super_admin');
            expect(result).not.toBeNull();
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('site');
        });

        it('returns { form, site } when access is granted', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u1' });

            const siteData = { id: 's1', domain: 'example.com', toJSON: () => ({ id: 's1', domain: 'example.com' }) };
            const mockForm = makeMockForm();
            mockForm.site = siteData;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);
            vi.mocked(models.Site.findOne).mockResolvedValue({ id: 's1', toJSON: () => ({ id: 's1' }) });

            const result = await verifyFormAccess('f1', 'u1', 'owner');
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('site');
        });

        it('returns null when site access is denied', async () => {
            const { getSiteWhereCondition } = await import('../../../src/services/access.service.js');
            vi.mocked(getSiteWhereCondition).mockReturnValue({ fk_id_user: 'u2' });

            const siteData = { id: 's1', domain: 'example.com', toJSON: () => ({ id: 's1', domain: 'example.com' }) };
            const mockForm = makeMockForm();
            mockForm.site = siteData;
            vi.mocked(models.Form.findByPk).mockResolvedValue(mockForm);
            vi.mocked(models.Site.findOne).mockResolvedValue(null);

            const result = await verifyFormAccess('f1', 'u2', 'viewer');
            expect(result).toBeNull();
        });
    });
});
