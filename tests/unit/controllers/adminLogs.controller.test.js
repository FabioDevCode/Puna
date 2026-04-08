/**
 * @file tests/unit/controllers/adminLogs.controller.test.js
 * Unit tests for adminLogs.controller.js
 */

import fs from 'fs/promises';
import * as tar from 'tar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countFileLines, countFilesRecursive, logsViewer, readLogs, getArchives } from '../../../src/controllers/admin/adminLogs.controller.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        access: vi.fn(),
        readdir: vi.fn(),
    },
}));

vi.mock('tar', () => ({
    t: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(queryOverrides = {}) {
    return {
        query: { date: 'today', type: 'app', ...queryOverrides },
        __: vi.fn((key) => key),
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
}

// ---------------------------------------------------------------------------
// countFileLines
// ---------------------------------------------------------------------------

describe('countFileLines()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the correct number of lines for multi-line content', async () => {
        fs.readFile.mockResolvedValue('line1\nline2\nline3\n');

        const result = await countFileLines('/some/file.log');

        expect(result).toBe(3);
    });

    it('returns 1 for a single-line file', async () => {
        fs.readFile.mockResolvedValue('single line');

        const result = await countFileLines('/some/file.log');

        expect(result).toBe(1);
    });

    it('returns 0 for an empty file', async () => {
        fs.readFile.mockResolvedValue('');

        const result = await countFileLines('/some/file.log');

        expect(result).toBe(0);
    });

    it('returns 0 for a file with only whitespace', async () => {
        fs.readFile.mockResolvedValue('   \n  \n  ');

        const result = await countFileLines('/some/file.log');

        expect(result).toBe(0);
    });

    it('returns 0 when file read fails', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

        const result = await countFileLines('/nonexistent/file.log');

        expect(result).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// countFilesRecursive
// ---------------------------------------------------------------------------

describe('countFilesRecursive()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 0 when directory does not exist', async () => {
        fs.access.mockRejectedValue(new Error('ENOENT'));

        const result = await countFilesRecursive('/nonexistent/dir');

        expect(result).toBe(0);
    });

    it('returns the number of files in a flat directory', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue([
            { name: 'file1.pdf', isDirectory: () => false, isFile: () => true },
            { name: 'file2.pdf', isDirectory: () => false, isFile: () => true },
            { name: 'file3.txt', isDirectory: () => false, isFile: () => true },
        ]);

        const result = await countFilesRecursive('/some/uploads');

        expect(result).toBe(3);
    });

    it('counts files recursively in subdirectories', async () => {
        fs.access.mockResolvedValue(undefined);

        let callCount = 0;
        fs.readdir.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return [
                    { name: 'subdir', isDirectory: () => true, isFile: () => false },
                    { name: 'file1.pdf', isDirectory: () => false, isFile: () => true },
                ];
            }
            // Second call (recursion into subdir)
            return [{ name: 'file2.pdf', isDirectory: () => false, isFile: () => true }];
        });

        const result = await countFilesRecursive('/some/uploads');

        expect(result).toBe(2);
    });

    it('returns 0 for an empty directory', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue([]);

        const result = await countFilesRecursive('/empty/dir');

        expect(result).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// logsViewer
// ---------------------------------------------------------------------------

describe('logsViewer()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders logs/viewer with empty archives when archive dir does not exist', async () => {
        fs.access.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq();
        const res = makeRes();

        await logsViewer(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'admin/logs/viewer',
            expect.objectContaining({
                layout: 'admin',
                logTypes: expect.arrayContaining(['app', 'api', 'audit', 'error']),
                archives: [],
            })
        );
    });

    it('renders logs/viewer with parsed archives', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue(['2025-01-15-archive-log.tar.gz', '2025-01-10-archive-log.tar.gz', '2025-01-05-180000-manual.tar.gz', 'invalid-file.txt']);

        const req = makeReq();
        const res = makeRes();

        await logsViewer(req, res);

        expect(res.render).toHaveBeenCalledWith(
            'admin/logs/viewer',
            expect.objectContaining({
                layout: 'admin',
                archives: expect.any(Array),
            })
        );
        const call = res.render.mock.calls[0][1];
        // 2 auto archives + 1 manual = 3 entries (invalid file is ignored)
        expect(call.archives).toHaveLength(3);
    });

    it('groups multiple auto archives for the same day into a single entry', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue(['2025-01-15-archive-log.tar.gz', '2025-01-15-startup-log.tar.gz']);

        const req = makeReq();
        const res = makeRes();

        await logsViewer(req, res);

        const call = res.render.mock.calls[0][1];
        expect(call.archives).toHaveLength(1);
        expect(call.archives[0].date).toBe('2025-01-15');
        expect(call.archives[0].filenames).toHaveLength(2);
        expect(call.archives[0].label).toContain('×2');
    });

    it('redirects to /admin on error', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockRejectedValue(new Error('Unexpected error'));

        const req = makeReq();
        const res = makeRes();

        await logsViewer(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/admin');
    });
});

// ---------------------------------------------------------------------------
// readLogs
// ---------------------------------------------------------------------------

describe('readLogs()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 for an invalid log type', async () => {
        const req = makeReq({ type: 'invalid_type' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'flash.admin_log_type_invalid' });
    });

    it('rejects path traversal via type parameter', async () => {
        const req = makeReq({ type: '../../etc/passwd' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('reads today log and returns parsed lines', async () => {
        const logLine1 = JSON.stringify({ time: 1000000000000, level: 30, msg: 'info message' });
        const logLine2 = JSON.stringify({ time: 2000000000000, level: 50, msg: 'error message' });
        fs.readFile.mockResolvedValue(`${logLine1}\n${logLine2}\n`);

        const req = makeReq({ date: 'today', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                date: 'today',
                type: 'app',
                count: 2,
                lines: expect.any(Array),
            })
        );
    });

    it('returns empty lines when today log file does not exist', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq({ date: 'today', type: 'error' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 0, lines: [] }));
    });

    it('filters lines by search query', async () => {
        const logLine1 = JSON.stringify({ time: 1000000000000, level: 30, msg: 'user login' });
        const logLine2 = JSON.stringify({ time: 2000000000000, level: 50, msg: 'error occurred' });
        fs.readFile.mockResolvedValue(`${logLine1}\n${logLine2}\n`);

        const req = makeReq({ date: 'today', type: 'app', search: 'login' });
        const res = makeRes();

        await readLogs(req, res);

        const call = res.json.mock.calls[0][0];
        expect(call.count).toBe(1);
        expect(call.lines[0].msg).toBe('user login');
    });

    it('filters lines by log level', async () => {
        const logLine1 = JSON.stringify({ time: 1000000000000, level: 30, msg: 'info' });
        const logLine2 = JSON.stringify({ time: 2000000000000, level: 50, msg: 'error' });
        fs.readFile.mockResolvedValue(`${logLine1}\n${logLine2}\n`);

        const req = makeReq({ date: 'today', type: 'app', level: '50' });
        const res = makeRes();

        await readLogs(req, res);

        const call = res.json.mock.calls[0][0];
        expect(call.count).toBe(1);
        expect(call.lines[0].level).toBe(50);
    });

    it('filters lines by time range', async () => {
        // Use a fixed date with known time parts
        const earlyLine = JSON.stringify({ time: new Date('2025-01-15T08:00:00').getTime(), level: 30, msg: 'early' });
        const lateLine = JSON.stringify({ time: new Date('2025-01-15T22:00:00').getTime(), level: 30, msg: 'late' });
        fs.readFile.mockResolvedValue(`${earlyLine}\n${lateLine}\n`);

        const req = makeReq({ date: 'today', type: 'app', timeFrom: '10:00', timeTo: '23:59' });
        const res = makeRes();

        await readLogs(req, res);

        const call = res.json.mock.calls[0][0];
        // Only the late line should pass the filter
        expect(call.count).toBe(1);
        expect(call.lines[0].msg).toBe('late');
    });

    it('handles non-JSON log lines gracefully', async () => {
        fs.readFile.mockResolvedValue('raw log line without json\n');

        const req = makeReq({ date: 'today', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        const call = res.json.mock.calls[0][0];
        expect(call.count).toBe(1);
        expect(call.lines[0].raw).toBe('raw log line without json');
    });

    it('sorts lines by time descending', async () => {
        const oldLine = JSON.stringify({ time: 1000000000000, level: 30, msg: 'old' });
        const newLine = JSON.stringify({ time: 2000000000000, level: 30, msg: 'new' });
        fs.readFile.mockResolvedValue(`${oldLine}\n${newLine}\n`);

        const req = makeReq({ date: 'today', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        const call = res.json.mock.calls[0][0];
        expect(call.lines[0].msg).toBe('new');
        expect(call.lines[1].msg).toBe('old');
    });

    it('returns 404 when manual archive is not found', async () => {
        fs.access.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq({ date: '2025-01-05-180000', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    it('reads a manual archive and returns log content', async () => {
        fs.access.mockResolvedValue(undefined);
        const logContent = JSON.stringify({ time: 1000000000000, level: 30, msg: 'from archive' });

        tar.t.mockImplementation(({ onReadEntry }) => {
            const entry = {
                path: 'app.log',
                on: vi.fn((event, handler) => {
                    if (event === 'data') handler(Buffer.from(logContent));
                    if (event === 'end') handler();
                }),
            };
            onReadEntry(entry);
            return Promise.resolve();
        });

        const req = makeReq({ date: '2025-01-05-180000', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                count: 1,
                lines: expect.arrayContaining([expect.objectContaining({ msg: 'from archive' })]),
            })
        );
    });

    it('returns 404 when calendar date archive entry is not found', async () => {
        // listArchives() will return empty list (archive dir doesn't exist)
        fs.access.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq({ date: '2025-01-15', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('reads a calendar date archive and returns joined log content', async () => {
        // Archive dir exists, has one archive for the target date
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue(['2025-01-15-archive-log.tar.gz']);

        const logContent = JSON.stringify({ time: 1000000000000, level: 30, msg: 'archive entry' });

        tar.t.mockImplementation(({ onReadEntry }) => {
            const entry = {
                path: 'app.log',
                on: vi.fn((event, handler) => {
                    if (event === 'data') handler(Buffer.from(logContent));
                    if (event === 'end') handler();
                }),
            };
            onReadEntry(entry);
            return Promise.resolve();
        });

        const req = makeReq({ date: '2025-01-15', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                count: 1,
                lines: expect.arrayContaining([expect.objectContaining({ msg: 'archive entry' })]),
            })
        );
    });

    it('returns 500 on unexpected error', async () => {
        // listArchives: access succeeds but readdir throws → propagates to outer catch
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockRejectedValue(new Error('Unexpected readdir error'));

        const req = makeReq({ date: '2025-01-15', type: 'app' });
        const res = makeRes();

        await readLogs(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'flash.admin_log_read_error' });
    });
});

// ---------------------------------------------------------------------------
// getArchives
// ---------------------------------------------------------------------------

describe('getArchives()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns an empty archives array when archive dir does not exist', async () => {
        fs.access.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq();
        const res = makeRes();

        await getArchives(req, res);

        expect(res.json).toHaveBeenCalledWith({ archives: [] });
    });

    it('returns parsed archives sorted by date descending', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockResolvedValue(['2025-01-10-archive-log.tar.gz', '2025-01-15-archive-log.tar.gz', '2025-01-05-180000-manual.tar.gz']);

        const req = makeReq();
        const res = makeRes();

        await getArchives(req, res);

        const call = res.json.mock.calls[0][0];
        expect(call.archives).toHaveLength(3);
        // Most recent first
        expect(call.archives[0].date).toBe('2025-01-15');
    });

    it('returns 500 on unexpected error', async () => {
        fs.access.mockResolvedValue(undefined);
        fs.readdir.mockRejectedValue(new Error('Unexpected'));

        const req = makeReq();
        const res = makeRes();

        await getArchives(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'flash.admin_log_archives_error' });
    });
});
