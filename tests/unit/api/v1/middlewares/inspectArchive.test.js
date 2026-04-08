/**
 * @file tests/unit/api/v1/middlewares/inspectArchive.test.js
 * Unit tests for inspectArchive middleware.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import inspectArchive from '../../../../../src/api/v1/middlewares/inspectArchive.js';

// ---------------------------------------------------------------------------
// Hoisted mock references (needed for the StreamZip class constructor pattern)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
    fsReadFile: vi.fn(),
    fsUnlink: vi.fn(),
    fsStat: vi.fn(),
    zipEntries: vi.fn(),
    zipClose: vi.fn(),
    errorLogger: { error: vi.fn() },
    zipConstructorShouldThrow: false,
}));

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: mocks.errorLogger,
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: mocks.fsReadFile,
        unlink: mocks.fsUnlink,
        stat: mocks.fsStat,
    },
}));

vi.mock('node-stream-zip', () => ({
    default: {
        async: class {
            constructor() {
                if (mocks.zipConstructorShouldThrow) {
                    throw new Error('StreamZip constructor failed');
                }
            }
            entries() {
                return mocks.zipEntries();
            }
            close() {
                return mocks.zipClose();
            }
        },
    },
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

/** Build a map of fake ZIP entries with safe filenames and given total size. */
function safeEntries(count = 2, sizeEach = 100) {
    const out = {};
    for (let i = 0; i < count; i++) {
        out[`file${i}.txt`] = { size: sizeEach };
    }
    return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inspectArchive middleware', () => {
    let req, res, next;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fsUnlink.mockResolvedValue(undefined);
        mocks.zipClose.mockResolvedValue(undefined);
        mocks.zipConstructorShouldThrow = false;
        // Default: small compressed file to keep compression ratio low
        mocks.fsStat.mockResolvedValue({ size: 10000 });

        req = { files: [] };
        res = makeRes();
        next = vi.fn();
    });

    // ── No files ──────────────────────────────────────────────────────────────

    it('no files (empty array) → calls next()', async () => {
        req.files = [];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('no files (undefined) → calls next()', async () => {
        req.files = undefined;
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    // ── Non-archive, non-PDF files ────────────────────────────────────────────

    it('non-archive file (.jpg) → calls next() without inspecting', async () => {
        req.files = [makeFile('file1', 'photo.jpg', '/tmp/photo.jpg')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(mocks.zipEntries).not.toHaveBeenCalled();
        expect(mocks.fsReadFile).not.toHaveBeenCalled();
    });

    it('non-archive file (.txt) → calls next()', async () => {
        req.files = [makeFile('file1', 'notes.txt', '/tmp/notes.txt')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('.tar file (not inspected) → calls next()', async () => {
        req.files = [makeFile('file1', 'archive.tar', '/tmp/archive.tar')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(mocks.zipEntries).not.toHaveBeenCalled();
    });

    // ── PDF checks ────────────────────────────────────────────────────────────

    it('PDF without /JavaScript → calls next()', async () => {
        mocks.fsReadFile.mockResolvedValue('%PDF-1.5 clean content');
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('PDF containing /JavaScript → 400 "PDF contains JavaScript"', async () => {
        mocks.fsReadFile.mockResolvedValue('%PDF-1.5 ... /JavaScript function attack() {}');
        req.files = [makeFile('file1', 'malicious.pdf', '/tmp/malicious.pdf')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'PDF contains JavaScript and is rejected' });
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/malicious.pdf');
    });

    it('PDF readFile fails gracefully → calls next()', async () => {
        mocks.fsReadFile.mockRejectedValue(new Error('Cannot read file'));
        req.files = [makeFile('file1', 'doc.pdf', '/tmp/doc.pdf')];
        await inspectArchive(req, res, next);
        // readFile has .catch(() => null), so buf is null → /JavaScript check is skipped
        expect(next).toHaveBeenCalledOnce();
    });

    // ── ZIP archive – valid ───────────────────────────────────────────────────

    it('valid ZIP with safe files → calls next()', async () => {
        mocks.zipEntries.mockResolvedValue(safeEntries(3, 1000));
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
        expect(mocks.zipClose).toHaveBeenCalled();
    });

    it('valid DOCX (zip-like) with safe files → calls next()', async () => {
        mocks.zipEntries.mockResolvedValue({
            'word/document.xml': { size: 5000 },
            '[Content_Types].xml': { size: 500 },
        });
        req.files = [makeFile('file1', 'report.docx', '/tmp/report.docx')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('valid XLSX (zip-like) with safe files → calls next()', async () => {
        mocks.zipEntries.mockResolvedValue({
            'xl/workbook.xml': { size: 2000 },
            '[Content_Types].xml': { size: 300 },
        });
        req.files = [makeFile('file1', 'data.xlsx', '/tmp/data.xlsx')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    // ── ZIP archive – too many entries ────────────────────────────────────────

    it('ZIP with more than 1000 entries → 400 "too many files"', async () => {
        const bigEntries = {};
        for (let i = 0; i < 1001; i++) {
            bigEntries[`file${i}.txt`] = { size: 10 };
        }
        mocks.zipEntries.mockResolvedValue(bigEntries);
        req.files = [makeFile('file1', 'massive.zip', '/tmp/massive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('too many files') }));
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/massive.zip');
    });

    // ── ZIP archive – entry name too long ─────────────────────────────────────

    it('ZIP entry name > 255 chars → 400 "name too long"', async () => {
        const longName = 'a'.repeat(256) + '.txt';
        mocks.zipEntries.mockResolvedValue({ [longName]: { size: 100 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('name too long') }));
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/archive.zip');
    });

    // ── ZIP archive – path traversal ──────────────────────────────────────────

    it('ZIP entry with "../" path traversal → 400 "suspicious file paths"', async () => {
        mocks.zipEntries.mockResolvedValue({ '../etc/passwd': { size: 100 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains suspicious file paths' });
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/archive.zip');
    });

    it('ZIP entry starting with "/" → 400 "suspicious file paths"', async () => {
        mocks.zipEntries.mockResolvedValue({ '/etc/passwd': { size: 100 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains suspicious file paths' });
    });

    // ── ZIP archive – uncompressed size limit ─────────────────────────────────

    it('ZIP total uncompressed size > 250 MB → 400 "uncompressed size too large"', async () => {
        const MAX_UNCOMPRESSED = 250 * 1024 * 1024;
        mocks.zipEntries.mockResolvedValue({
            'bigfile.bin': { size: MAX_UNCOMPRESSED + 1 },
        });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('uncompressed size too large') }));
    });

    // ── ZIP archive – VBA macros ──────────────────────────────────────────────

    it('ZIP containing vbaProject.bin (macros) → 400 "contains macros"', async () => {
        mocks.zipEntries.mockResolvedValue({
            'xl/vbaProject.bin': { size: 200 },
        });
        req.files = [makeFile('file1', 'spreadsheet.xlsx', '/tmp/spreadsheet.xlsx')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Document contains macros and is rejected' });
    });

    it('ZIP containing a file with "vba" in path → 400 "contains macros"', async () => {
        mocks.zipEntries.mockResolvedValue({
            'word/vba/module1.bas': { size: 100 },
        });
        req.files = [makeFile('file1', 'doc.docx', '/tmp/doc.docx')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Document contains macros and is rejected' });
    });

    // ── ZIP archive – executable files ───────────────────────────────────────

    it('ZIP containing .exe → 400 "contains executable files"', async () => {
        mocks.zipEntries.mockResolvedValue({ 'malware.exe': { size: 50000 } });
        req.files = [makeFile('file1', 'package.zip', '/tmp/package.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains executable files and is rejected' });
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/package.zip');
    });

    it('ZIP containing .sh shell script → 400 "contains executable files"', async () => {
        mocks.zipEntries.mockResolvedValue({ 'scripts/setup.sh': { size: 300 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains executable files and is rejected' });
    });

    it('ZIP containing .bat → 400 "contains executable files"', async () => {
        mocks.zipEntries.mockResolvedValue({ 'run.bat': { size: 150 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains executable files and is rejected' });
    });

    it('ZIP containing .dll → 400 "contains executable files"', async () => {
        mocks.zipEntries.mockResolvedValue({ 'lib/native.dll': { size: 80000 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ZIP with double extension ending in .sh → 400 "contains executable files"', async () => {
        mocks.zipEntries.mockResolvedValue({ 'image.jpg.sh': { size: 300 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains executable files and is rejected' });
    });

    it('ZIP with .exe and unlink fails → errorLogger called, still returns 400', async () => {
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        mocks.zipEntries.mockResolvedValue({ 'virus.exe': { size: 1000 } });
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains executable files and is rejected' });
        expect(mocks.errorLogger.error).toHaveBeenCalled();
    });

    // ── ZIP archive – zip bomb (high compression ratio) ───────────────────────

    it('ZIP with compression ratio > 100 (zip bomb) → 400 "compression ratio too high"', async () => {
        // compressedSize = 100 bytes, uncompressed = 10100 bytes → ratio = 101 > 100
        mocks.fsStat.mockResolvedValue({ size: 100 });
        mocks.zipEntries.mockResolvedValue({ 'bomb.txt': { size: 10100 } });
        req.files = [makeFile('file1', 'bomb.zip', '/tmp/bomb.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('compression ratio too high') }));
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/bomb.zip');
    });

    it('ZIP with compressedSize = 0 → skips ratio check, calls next()', async () => {
        mocks.fsStat.mockResolvedValue({ size: 0 });
        mocks.zipEntries.mockResolvedValue({ 'file.txt': { size: 0 } });
        req.files = [makeFile('file1', 'empty.zip', '/tmp/empty.zip')];
        await inspectArchive(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    // ── ZIP archive – corrupted / unreadable ──────────────────────────────────

    it('corrupted ZIP (entries() throws) → 400 "could not be inspected"', async () => {
        mocks.zipEntries.mockRejectedValue(new Error('Invalid ZIP signature'));
        req.files = [makeFile('file1', 'corrupt.zip', '/tmp/corrupt.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive could not be inspected and is rejected' });
        expect(mocks.fsUnlink).toHaveBeenCalledWith('/tmp/corrupt.zip');
    });

    it('corrupted ZIP and unlink also fails → still returns 400', async () => {
        mocks.zipEntries.mockRejectedValue(new Error('Bad ZIP'));
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'corrupt.zip', '/tmp/corrupt.zip')];
        await inspectArchive(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive could not be inspected and is rejected' });
    });

    it('corrupted ZIP and close() also throws → errorLogger called, still returns 400', async () => {
        mocks.zipEntries.mockRejectedValue(new Error('Bad ZIP'));
        mocks.zipClose.mockRejectedValue(new Error('Cannot close stream'));
        req.files = [makeFile('file1', 'corrupt.zip', '/tmp/corrupt.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive could not be inspected and is rejected' });
        expect(mocks.errorLogger.error).toHaveBeenCalled();
    });

    // ── Multiple files – first triggers error ────────────────────────────────

    it('first file is clean JPG, second file is zip with .exe → 400', async () => {
        mocks.zipEntries.mockResolvedValue({ 'virus.exe': { size: 1000 } });
        req.files = [makeFile('photo', 'photo.jpg', '/tmp/photo.jpg'), makeFile('archive', 'pkg.zip', '/tmp/pkg.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // ── Outer try/catch – unexpected exception ────────────────────────────────

    it('StreamZip constructor throws → 500 "Archive inspection failed"', async () => {
        mocks.zipConstructorShouldThrow = true;
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive inspection failed' });
    });

    it('StreamZip constructor throws and unlink also fails → still returns 500', async () => {
        mocks.zipConstructorShouldThrow = true;
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive inspection failed' });
    });

    // ── Unlink failure in specific .catch(() => {}) paths ────────────────────
    // These tests trigger the empty .catch(() => {}) callbacks on each error path

    it('PDF with /JavaScript and unlink fails → still returns 400', async () => {
        mocks.fsReadFile.mockResolvedValue('%PDF-1.5 /JavaScript attack');
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'malicious.pdf', '/tmp/malicious.pdf')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'PDF contains JavaScript and is rejected' });
    });

    it('ZIP with too many entries and unlink fails → still returns 400', async () => {
        const bigEntries = {};
        for (let i = 0; i < 1001; i++) {
            bigEntries[`file${i}.txt`] = { size: 10 };
        }
        mocks.zipEntries.mockResolvedValue(bigEntries);
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'massive.zip', '/tmp/massive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('too many files') }));
    });

    it('ZIP with entry name too long and unlink fails → still returns 400', async () => {
        const longName = 'a'.repeat(256) + '.txt';
        mocks.zipEntries.mockResolvedValue({ [longName]: { size: 100 } });
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ZIP with path traversal and unlink fails → still returns 400', async () => {
        mocks.zipEntries.mockResolvedValue({ '../etc/passwd': { size: 100 } });
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive contains suspicious file paths' });
    });

    it('ZIP uncompressed size too large and unlink fails → still returns 400', async () => {
        const MAX_UNCOMPRESSED = 250 * 1024 * 1024;
        mocks.zipEntries.mockResolvedValue({ 'bigfile.bin': { size: MAX_UNCOMPRESSED + 1 } });
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'archive.zip', '/tmp/archive.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ZIP bomb and unlink fails → still returns 400', async () => {
        mocks.fsStat.mockResolvedValue({ size: 100 });
        mocks.zipEntries.mockResolvedValue({ 'bomb.txt': { size: 10100 } });
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'bomb.zip', '/tmp/bomb.zip')];
        await inspectArchive(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('compression ratio too high') }));
    });

    it('corrupted ZIP, close() throws and unlink also fails → errorLogger called, still returns 400', async () => {
        mocks.zipEntries.mockRejectedValue(new Error('Bad ZIP'));
        mocks.zipClose.mockRejectedValue(new Error('Cannot close stream'));
        mocks.fsUnlink.mockRejectedValue(new Error('Permission denied'));
        req.files = [makeFile('file1', 'corrupt.zip', '/tmp/corrupt.zip')];
        await inspectArchive(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Archive could not be inspected and is rejected' });
        expect(mocks.errorLogger.error).toHaveBeenCalled();
    });
});
