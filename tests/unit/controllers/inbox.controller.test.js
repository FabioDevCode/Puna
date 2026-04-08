/**
 * @file tests/unit/controllers/inbox.controller.test.js
 * Unit tests for inbox.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showInbox, deleteInbox, downloadFile } from '../../../src/controllers/inbox.controller.js';
import { getInboxForDisplay, deleteInboxWithFiles, verifyFileAccessAndGetPath } from '../../../src/services/inbox.service.js';

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

vi.mock('../../../src/services/inbox.service.js', () => ({
    getInboxForDisplay: vi.fn(),
    deleteInboxWithFiles: vi.fn(),
    verifyFileAccessAndGetPath: vi.fn(),
}));

vi.mock('../../../src/helpers/file.helpers.js', () => ({
    getFileTypeInfo: vi.fn(() => ({ icon: 'file', mime: 'application/octet-stream' })),
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
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
        send: vi.fn(),
        download: vi.fn(),
        end: vi.fn(),
        headersSent: false,
    };
}

// ---------------------------------------------------------------------------
// showInbox
// ---------------------------------------------------------------------------

describe('showInbox', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { id: 'inbox-1' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('redirects to dashboard when inbox not found', async () => {
        getInboxForDisplay.mockResolvedValue(null);

        await showInbox(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
        expect(res.render).not.toHaveBeenCalled();
    });

    it('renders the inbox show view with correct data', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: new Date('2024-01-15T10:00:00Z') },
            form: { template: JSON.stringify({ name: 'Nom' }) },
            site: { domain: 'example.com' },
            contentObj: { name: 'Alice' },
            templateObj: { name: 'Nom' },
            fileKeys: [],
        });

        await showInbox(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'inbox/show',
            expect.objectContaining({
                inbox: expect.any(Object),
                form: expect.any(Object),
                site: expect.any(Object),
                contentEntries: expect.any(Array),
                fileEntries: expect.any(Array),
                formattedDate: expect.any(String),
            })
        );
    });

    it('builds contentEntries excluding file keys', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: new Date() },
            form: { template: JSON.stringify({ name: 'Nom', upload: 'Fichier' }) },
            site: {},
            contentObj: { name: 'Alice', upload: 'timestamp_file.pdf' },
            templateObj: { name: 'Nom', upload: 'Fichier' },
            fileKeys: ['upload'],
        });

        await showInbox(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.contentEntries).toHaveLength(1);
        expect(call.contentEntries[0].key).toBe('name');
    });

    it('builds fileEntries for file keys', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: new Date() },
            form: { template: JSON.stringify({ upload: 'Fichier' }) },
            site: {},
            contentObj: { upload: 'ts_file.pdf' },
            templateObj: { upload: 'Fichier' },
            fileKeys: ['upload'],
        });

        await showInbox(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.fileEntries).toHaveLength(1);
        expect(call.fileEntries[0].filename).toBe('ts_file.pdf');
    });

    it('handles array file values', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: new Date() },
            form: { template: JSON.stringify({ docs: 'Docs' }) },
            site: {},
            contentObj: { docs: ['ts_a.pdf', 'ts_b.pdf'] },
            templateObj: { docs: 'Docs' },
            fileKeys: ['docs'],
        });

        await showInbox(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.fileEntries).toHaveLength(2);
    });

    it('uses null-safe content values in contentEntries', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: new Date() },
            form: { template: null },
            site: {},
            contentObj: { field: null },
            templateObj: {},
            fileKeys: [],
        });

        await showInbox(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.contentEntries[0].value).toBe('-');
    });

    it('redirects to dashboard on service error', async () => {
        getInboxForDisplay.mockRejectedValue(new Error('DB error'));

        await showInbox(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('formats date as dash when createdAt is missing', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1', createdAt: null },
            form: { template: null },
            site: {},
            contentObj: {},
            templateObj: {},
            fileKeys: [],
        });

        await showInbox(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.formattedDate).toBe('-');
    });
});

// ---------------------------------------------------------------------------
// deleteInbox
// ---------------------------------------------------------------------------

describe('deleteInbox', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { id: 'inbox-1' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('flashes error and redirects to dashboard when inbox not found', async () => {
        getInboxForDisplay.mockResolvedValue(null);

        await deleteInbox(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes error and redirects when delete service returns failure', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1' },
            form: { fk_id_site: 'site-1', name: 'TestForm' },
            site: {},
            contentObj: {},
            templateObj: {},
            fileKeys: [],
        });
        deleteInboxWithFiles.mockResolvedValue({ success: false, error: 'some error' });

        await deleteInbox(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes success and redirects to site view on success', async () => {
        getInboxForDisplay.mockResolvedValue({
            inbox: { id: 'inbox-1' },
            form: { fk_id_site: 'site-42', name: 'ContactForm' },
            site: {},
            contentObj: {},
            templateObj: {},
            fileKeys: [],
        });
        deleteInboxWithFiles.mockResolvedValue({ success: true });

        await deleteInbox(req, res);

        expect(res.flash).toHaveBeenCalledWith('success', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/site/site-42/view?f=ContactForm');
    });

    it('flashes error and redirects to dashboard on service exception', async () => {
        getInboxForDisplay.mockRejectedValue(new Error('DB error'));

        await deleteInbox(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', expect.any(String));
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});

// ---------------------------------------------------------------------------
// downloadFile
// ---------------------------------------------------------------------------

describe('downloadFile', () => {
    let req, res;

    beforeEach(() => {
        req = makeReq({ params: { inboxId: 'inbox-1', filename: 'ts123_document.pdf' } });
        res = makeRes();
        vi.clearAllMocks();
    });

    it('returns 404 when access verification fails', async () => {
        verifyFileAccessAndGetPath.mockResolvedValue({ success: false, error: 'Not found' });

        await downloadFile(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('calls res.download with correct path and original filename', async () => {
        verifyFileAccessAndGetPath.mockResolvedValue({ success: true, filePath: '/storage/uploads/site/ts123_document.pdf' });

        await downloadFile(req, res);

        expect(res.download).toHaveBeenCalledWith('/storage/uploads/site/ts123_document.pdf', 'document.pdf', expect.any(Function));
    });

    it('returns 500 on unexpected service exception', async () => {
        verifyFileAccessAndGetPath.mockRejectedValue(new Error('Unexpected'));

        await downloadFile(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('calls verifyFileAccessAndGetPath with correct parameters', async () => {
        verifyFileAccessAndGetPath.mockResolvedValue({ success: false, error: 'Not found' });

        await downloadFile(req, res);

        expect(verifyFileAccessAndGetPath).toHaveBeenCalledWith('inbox-1', 'ts123_document.pdf', 'user-1', 'owner');
    });

    it('download callback handles error when headers not sent', async () => {
        verifyFileAccessAndGetPath.mockResolvedValue({ success: true, filePath: '/path/file.pdf' });
        res.download.mockImplementation((_path, _name, cb) => cb(new Error('Download error')));

        await downloadFile(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error downloading file' });
    });

    it('download callback does not re-send when headers already sent', async () => {
        verifyFileAccessAndGetPath.mockResolvedValue({ success: true, filePath: '/path/file.pdf' });
        res.headersSent = true;
        res.download.mockImplementation((_path, _name, cb) => cb(new Error('Download error')));

        await downloadFile(req, res);

        expect(res.status).not.toHaveBeenCalled();
    });
});
