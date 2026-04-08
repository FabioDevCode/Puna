/**
 * @file tests/unit/api/v1/middlewares/validateUpload.test.js
 * Unit tests for validateUpload middleware.
 */

import fs from 'fs/promises';
import { fileTypeFromFile } from 'file-type';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validateUpload from '../../../../../src/api/v1/middlewares/validateUpload.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        unlink: vi.fn(),
    },
}));

vi.mock('file-type', () => ({
    fileTypeFromFile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(fieldname, originalname, filePath) {
    return { fieldname, originalname, path: filePath };
}

function makeRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateUpload middleware', () => {
    let req, res, next;

    beforeEach(() => {
        vi.clearAllMocks();
        fs.unlink.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from(''));

        req = { files: [] };
        res = makeRes();
        next = vi.fn();
    });

    // ── No files ──────────────────────────────────────────────────────────────

    it('no files (empty array) → calls next()', async () => {
        req.files = [];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('no files (undefined) → calls next()', async () => {
        req.files = undefined;
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    // ── Multiple files in same field ──────────────────────────────────────────

    it('two files with same fieldname → 400 "One file per field allowed"', async () => {
        // fileTypeFromFile must match for the first file so it passes validation
        // and the duplicate check fires when the second file is encountered
        fileTypeFromFile.mockResolvedValue({ ext: 'png', mime: 'image/png' });
        req.files = [makeFile('upload', 'a.png', '/tmp/a.png'), makeFile('upload', 'b.png', '/tmp/b.png')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'One file per field allowed' });
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/a.png');
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/b.png');
    });

    // ── Extension checks ──────────────────────────────────────────────────────

    it('disallowed extension (.exe) → 400 "Extension not allowed"', async () => {
        req.files = [makeFile('file1', 'malware.exe', '/tmp/malware.exe')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Extension not allowed: .exe' });
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/malware.exe');
    });

    it('disallowed extension (.php) → 400 "Extension not allowed"', async () => {
        req.files = [makeFile('file1', 'shell.php', '/tmp/shell.php')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Extension not allowed: .php' });
    });

    // ── fileTypeFromFile detects matching type ────────────────────────────────

    it('allowed extension .png, fileTypeFromFile matches → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'png', mime: 'image/png' });
        req.files = [makeFile('file1', 'photo.png', '/tmp/photo.png')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('allowed extension .jpg, fileTypeFromFile matches → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });
        req.files = [makeFile('file1', 'photo.jpg', '/tmp/photo.jpg')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('allowed extension .pdf, fileTypeFromFile matches → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    // ── fileTypeFromFile detects mismatched type ──────────────────────────────

    it('extension .png but fileTypeFromFile returns jpg → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });
        req.files = [makeFile('file1', 'photo.png', '/tmp/photo.png')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/photo.png');
    });

    it('extension .pdf but fileTypeFromFile returns zip → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'zip', mime: 'application/zip' });
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    // ── fileTypeFromFile returns undefined – text/csv passthrough ─────────────

    it('fileTypeFromFile undefined, .txt → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        req.files = [makeFile('file1', 'notes.txt', '/tmp/notes.txt')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .csv → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        req.files = [makeFile('file1', 'data.csv', '/tmp/data.csv')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    // ── fileTypeFromFile undefined – PDF header checks ────────────────────────

    it('fileTypeFromFile undefined, .pdf with valid header → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('%PDF-1.5 some content'));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .pdf with invalid header → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('not a pdf'));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    it('fileTypeFromFile undefined, .pdf readFile returns empty buffer → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.alloc(0));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // ── fileTypeFromFile undefined – PNG header checks ────────────────────────

    it('fileTypeFromFile undefined, .png with valid PNG signature → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
        fs.readFile.mockResolvedValue(pngSig);
        req.files = [makeFile('file1', 'img.png', '/tmp/img.png')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .png with invalid header → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('not a png image'));
        req.files = [makeFile('file1', 'img.png', '/tmp/img.png')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    // ── fileTypeFromFile undefined – JPEG header checks ──────────────────────

    it('fileTypeFromFile undefined, .jpg with valid JPEG signature → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        const jpegSig = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        fs.readFile.mockResolvedValue(jpegSig);
        req.files = [makeFile('file1', 'img.jpg', '/tmp/img.jpg')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .jpeg with valid JPEG signature → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        const jpegSig = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);
        fs.readFile.mockResolvedValue(jpegSig);
        req.files = [makeFile('file1', 'img.jpeg', '/tmp/img.jpeg')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .jpg with invalid header → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('not jpeg'));
        req.files = [makeFile('file1', 'img.jpg', '/tmp/img.jpg')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // ── fileTypeFromFile undefined – WebP header checks ──────────────────────

    it('fileTypeFromFile undefined, .webp with valid WEBP signature → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        const webpBuf = Buffer.alloc(12);
        Buffer.from('RIFF').copy(webpBuf, 0);
        Buffer.from('WEBP').copy(webpBuf, 8);
        fs.readFile.mockResolvedValue(webpBuf);
        req.files = [makeFile('file1', 'img.webp', '/tmp/img.webp')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('fileTypeFromFile undefined, .webp with invalid header → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('not webp content here'));
        req.files = [makeFile('file1', 'img.webp', '/tmp/img.webp')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // ── fileTypeFromFile undefined – unverifiable binary formats ─────────────

    it('fileTypeFromFile undefined, .doc → 400 "Unable to verify file content"', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        req.files = [makeFile('file1', 'document.doc', '/tmp/document.doc')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unable to verify file content for file1' });
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/document.doc');
    });

    it('fileTypeFromFile undefined, .xls → 400 "Unable to verify file content"', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        req.files = [makeFile('file1', 'sheet.xls', '/tmp/sheet.xls')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unable to verify file content for file1' });
    });

    // ── Multiple valid files with different fieldnames ────────────────────────

    it('two valid files with different fieldnames → calls next()', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'png', mime: 'image/png' });
        req.files = [makeFile('photo', 'photo.png', '/tmp/photo.png'), makeFile('avatar', 'avatar.png', '/tmp/avatar.png')];
        await validateUpload(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    // ── Unexpected exception ──────────────────────────────────────────────────

    it('unexpected exception → 500 "Upload validation failed"', async () => {
        fileTypeFromFile.mockRejectedValue(new Error('Unexpected I/O error'));
        req.files = [makeFile('file1', 'photo.png', '/tmp/photo.png')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Upload validation failed' });
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/photo.png');
    });

    it('unlink fails during cleanup → still returns 500', async () => {
        fileTypeFromFile.mockRejectedValue(new Error('Unexpected error'));
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'photo.png', '/tmp/photo.png')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    // ── Unlink failure in specific error paths ────────────────────────────────

    it('extension not allowed and unlink fails → still returns 400', async () => {
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'malware.exe', '/tmp/malware.exe')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Extension not allowed: .exe' });
    });

    it('content mismatch detected by fileTypeFromFile and unlink fails → still returns 400', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'photo.png', '/tmp/photo.png')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    it('unable to verify content and unlink fails → still returns 400', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'document.doc', '/tmp/document.doc')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unable to verify file content for file1' });
    });

    it('invalid header detected and unlink fails → still returns 400', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockResolvedValue(Buffer.from('not a pdf'));
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    it('duplicate field cleanup unlink fails → still returns 400', async () => {
        fileTypeFromFile.mockResolvedValue({ ext: 'png', mime: 'image/png' });
        fs.unlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('upload', 'a.png', '/tmp/a.png'), makeFile('upload', 'b.png', '/tmp/b.png')];
        await validateUpload(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'One file per field allowed' });
    });

    // ── readFile rejection in header-check functions ──────────────────────────

    it('fileTypeFromFile undefined, .pdf readFile rejects → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockRejectedValue(new Error('IO error'));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'File content does not match extension for file1' });
    });

    it('fileTypeFromFile undefined, .png readFile rejects → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockRejectedValue(new Error('IO error'));
        req.files = [makeFile('file1', 'img.png', '/tmp/img.png')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('fileTypeFromFile undefined, .jpg readFile rejects → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockRejectedValue(new Error('IO error'));
        req.files = [makeFile('file1', 'img.jpg', '/tmp/img.jpg')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('fileTypeFromFile undefined, .webp readFile rejects → 400 content mismatch', async () => {
        fileTypeFromFile.mockResolvedValue(undefined);
        fs.readFile.mockRejectedValue(new Error('IO error'));
        req.files = [makeFile('file1', 'img.webp', '/tmp/img.webp')];
        await validateUpload(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
