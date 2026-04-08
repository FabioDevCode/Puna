/**
 * @file tests/unit/controllers/export.controller.test.js
 * Unit tests for export.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadInboxZip, exportFormToExcel, exportFormToCSV, exportAllSubmissionsToCSV } from '../../../src/controllers/export.controller.js';
import {
    getInboxWithFiles,
    createZipArchive,
    getFormDataForExport,
    generateExcelWorkbook,
    generateFormCSV,
    getAllSubmissionsForExport,
    generateMultiFormCSV,
} from '../../../src/services/export.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), warn: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {},
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/export.service.js', () => ({
    getInboxWithFiles: vi.fn(),
    createZipArchive: vi.fn(),
    getFormDataForExport: vi.fn(),
    generateExcelWorkbook: vi.fn(),
    generateFormCSV: vi.fn(),
    getAllSubmissionsForExport: vi.fn(),
    generateMultiFormCSV: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
    return {
        params: {},
        query: {},
        body: {},
        session: { user: { id: 'user-1' } },
        userRole: 'owner',
        __: vi.fn((key) => key),
        ...overrides,
    };
}

function makeRes() {
    const res = {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        attachment: vi.fn(),
        send: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        download: vi.fn(),
        headersSent: false,
    };
    return res;
}

// ---------------------------------------------------------------------------
// downloadInboxZip
// ---------------------------------------------------------------------------

describe('downloadInboxZip', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { inboxId: 'inbox-1' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns 404 when inbox not found', async () => {
        getInboxWithFiles.mockResolvedValue(null);

        await downloadInboxZip(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Inbox entry not found or access denied' });
    });

    it('returns 404 when no files in inbox', async () => {
        getInboxWithFiles.mockResolvedValue({ files: [] });

        await downloadInboxZip(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'No files found to download' });
    });

    it('sets correct headers and pipes archive when files exist', async () => {
        const mockArchive = {
            on: vi.fn(),
            pipe: vi.fn(),
            finalize: vi.fn().mockResolvedValue(undefined),
        };
        getInboxWithFiles.mockResolvedValue({ files: ['file1.pdf'] });
        createZipArchive.mockResolvedValue(mockArchive);

        await downloadInboxZip(req, res);

        expect(res.attachment).toHaveBeenCalledWith('inbox_inbox-1_documents.zip');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
        expect(mockArchive.pipe).toHaveBeenCalledWith(res);
        expect(mockArchive.finalize).toHaveBeenCalled();
    });

    it('returns 500 on service error', async () => {
        getInboxWithFiles.mockRejectedValue(new Error('DB error'));

        await downloadInboxZip(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('does not send response again when headers already sent on error', async () => {
        getInboxWithFiles.mockRejectedValue(new Error('DB error'));
        res.headersSent = true;

        await downloadInboxZip(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it('calls getInboxWithFiles with correct params', async () => {
        getInboxWithFiles.mockResolvedValue(null);

        await downloadInboxZip(req, res);

        expect(getInboxWithFiles).toHaveBeenCalledWith('inbox-1', 'user-1', 'owner');
    });
});

// ---------------------------------------------------------------------------
// exportFormToExcel
// ---------------------------------------------------------------------------

describe('exportFormToExcel', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { id: 'form-1' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns 404 when form not found', async () => {
        getFormDataForExport.mockResolvedValue(null);

        await exportFormToExcel(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Form not found or access denied' });
    });

    it('sets correct content-type and disposition headers', async () => {
        const mockWorkbook = { xlsx: { write: vi.fn().mockResolvedValue(undefined) } };
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: JSON.stringify({ field1: 'Field One' }) },
            submissions: [{ content: JSON.stringify({ field1: 'value1' }) }],
        });
        generateExcelWorkbook.mockResolvedValue(mockWorkbook);

        await exportFormToExcel(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="export_TestForm_'));
        expect(res.end).toHaveBeenCalled();
    });

    it('handles object template (non-string)', async () => {
        const mockWorkbook = { xlsx: { write: vi.fn().mockResolvedValue(undefined) } };
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: { field1: 'Field One' } },
            submissions: [],
        });
        generateExcelWorkbook.mockResolvedValue(mockWorkbook);

        await exportFormToExcel(req, res);

        expect(generateExcelWorkbook).toHaveBeenCalled();
    });

    it('handles missing template gracefully', async () => {
        const mockWorkbook = { xlsx: { write: vi.fn().mockResolvedValue(undefined) } };
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: null },
            submissions: [],
        });
        generateExcelWorkbook.mockResolvedValue(mockWorkbook);

        await exportFormToExcel(req, res);

        expect(generateExcelWorkbook).toHaveBeenCalled();
    });

    it('handles invalid JSON template gracefully', async () => {
        const mockWorkbook = { xlsx: { write: vi.fn().mockResolvedValue(undefined) } };
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: 'not-valid-json{' },
            submissions: [],
        });
        generateExcelWorkbook.mockResolvedValue(mockWorkbook);

        await exportFormToExcel(req, res);

        expect(generateExcelWorkbook).toHaveBeenCalled();
    });

    it('handles invalid JSON content in submission gracefully', async () => {
        const mockWorkbook = { xlsx: { write: vi.fn().mockResolvedValue(undefined) } };
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: null },
            submissions: [{ content: 'invalid-json{' }],
        });
        generateExcelWorkbook.mockResolvedValue(mockWorkbook);

        await exportFormToExcel(req, res);

        expect(generateExcelWorkbook).toHaveBeenCalled();
    });

    it('returns 500 on service error', async () => {
        getFormDataForExport.mockRejectedValue(new Error('DB error'));

        await exportFormToExcel(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('does not send response again when headers already sent on error', async () => {
        getFormDataForExport.mockRejectedValue(new Error('DB error'));
        res.headersSent = true;

        await exportFormToExcel(req, res);

        expect(res.status).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// exportFormToCSV
// ---------------------------------------------------------------------------

describe('exportFormToCSV', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { id: 'form-1' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns 404 when form not found', async () => {
        getFormDataForExport.mockResolvedValue(null);

        await exportFormToCSV(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Form not found or access denied' });
    });

    it('sets correct content-type header for CSV', async () => {
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: null },
            submissions: [],
        });
        generateFormCSV.mockResolvedValue('col1,col2\nval1,val2');

        await exportFormToCSV(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="export_TestForm_'));
    });

    it('writes BOM and CSV data to response', async () => {
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: null },
            submissions: [],
        });
        generateFormCSV.mockResolvedValue('col1,col2\nval1,val2');

        await exportFormToCSV(req, res);

        expect(res.write).toHaveBeenCalledWith('\uFEFF');
        expect(res.write).toHaveBeenCalledWith('col1,col2\nval1,val2');
        expect(res.end).toHaveBeenCalled();
    });

    it('extracts custom columns from submissions and template', async () => {
        getFormDataForExport.mockResolvedValue({
            form: { name: 'TestForm', template: JSON.stringify({ name: 'Nom' }) },
            submissions: [{ content: JSON.stringify({ name: 'Alice', email: 'a@b.com' }) }],
        });
        generateFormCSV.mockResolvedValue('');

        await exportFormToCSV(req, res);

        expect(generateFormCSV).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.arrayContaining([expect.objectContaining({ key: 'name', header: 'Nom' }), expect.objectContaining({ key: 'email', header: 'email' })])
        );
    });

    it('returns 500 on service error', async () => {
        getFormDataForExport.mockRejectedValue(new Error('DB error'));

        await exportFormToCSV(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('does not double-send when headers already sent on error', async () => {
        getFormDataForExport.mockRejectedValue(new Error('DB error'));
        res.headersSent = true;

        await exportFormToCSV(req, res);

        expect(res.status).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// exportAllSubmissionsToCSV
// ---------------------------------------------------------------------------

describe('exportAllSubmissionsToCSV', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq();
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns 404 when no submissions found', async () => {
        getAllSubmissionsForExport.mockResolvedValue([]);

        await exportAllSubmissionsToCSV(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'No submissions found' });
    });

    it('returns 404 when service returns null', async () => {
        getAllSubmissionsForExport.mockResolvedValue(null);

        await exportAllSubmissionsToCSV(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'No submissions found' });
    });

    it('sets correct headers and writes CSV data', async () => {
        getAllSubmissionsForExport.mockResolvedValue([{ id: 1 }]);
        generateMultiFormCSV.mockResolvedValue('site,form,data\n');

        await exportAllSubmissionsToCSV(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('export_all_submissions_'));
        expect(res.write).toHaveBeenCalledWith('\uFEFF');
        expect(res.write).toHaveBeenCalledWith('site,form,data\n');
        expect(res.end).toHaveBeenCalled();
    });

    it('calls service with correct user params', async () => {
        getAllSubmissionsForExport.mockResolvedValue([{ id: 1 }]);
        generateMultiFormCSV.mockResolvedValue('');

        await exportAllSubmissionsToCSV(req, res);

        expect(getAllSubmissionsForExport).toHaveBeenCalledWith('user-1', 'owner');
    });

    it('returns 500 on service error', async () => {
        getAllSubmissionsForExport.mockRejectedValue(new Error('DB error'));

        await exportAllSubmissionsToCSV(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('does not double-send when headers already sent on error', async () => {
        getAllSubmissionsForExport.mockRejectedValue(new Error('DB error'));
        res.headersSent = true;

        await exportAllSubmissionsToCSV(req, res);

        expect(res.status).not.toHaveBeenCalled();
    });
});
