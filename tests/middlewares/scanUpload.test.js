import { vi, describe, test, expect, beforeEach } from 'vitest';

// Stable mock references hoisted before any imports
const mocks = vi.hoisted(() => ({
    isInfected: vi.fn(),
    init: vi.fn(),
    removeFile: vi.fn(),
    apiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn() },
}));

// Use a class so that `new NodeClam()` works correctly in Vitest 4.x
vi.mock('clamscan', () => {
    class NodeClamMock {
        init(...args) {
            return mocks.init(...args);
        }
    }
    return { default: NodeClamMock };
});

vi.mock('../../src/helpers/upload.helpers.js', () => ({
    removeFile: mocks.removeFile,
}));

vi.mock('../../src/config/logger.js', () => ({
    apiLogger: mocks.apiLogger,
    errorLogger: mocks.errorLogger,
}));

describe('scanUpload middleware', () => {
    function makeReq(files) {
        return { files, params: { code: 'TEST' }, ip: '127.0.0.1' };
    }

    function makeRes() {
        return { status: vi.fn().mockReturnThis(), json: vi.fn() };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: init resolves with a clam instance, removeFile resolves
        mocks.init.mockResolvedValue({ isInfected: mocks.isInfected });
        mocks.removeFile.mockResolvedValue(undefined);
    });

    describe('CLAMAV_ENABLED=false (pass-through)', () => {
        test('calls next() immediately and NodeClam.init() is never called', async () => {
            vi.resetModules();
            vi.stubEnv('CLAMAV_ENABLED', 'false');
            const { default: scanUpload } = await import('../../src/api/v1/middlewares/scanUpload.js');

            const req = makeReq([{ path: '/tmp/file.txt', originalname: 'file.txt' }]);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(mocks.init).not.toHaveBeenCalled();
        });

        test('calls next() when CLAMAV_ENABLED is not set', async () => {
            vi.resetModules();
            vi.stubEnv('CLAMAV_ENABLED', '');
            const { default: scanUpload } = await import('../../src/api/v1/middlewares/scanUpload.js');

            const req = makeReq([{ path: '/tmp/file.txt', originalname: 'file.txt' }]);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).toHaveBeenCalledOnce();
        });
    });

    describe('CLAMAV_ENABLED=true', () => {
        let scanUpload;

        beforeEach(async () => {
            vi.resetModules();
            vi.stubEnv('CLAMAV_ENABLED', 'true');
            ({ default: scanUpload } = await import('../../src/api/v1/middlewares/scanUpload.js'));
        });

        test('calls next() when req.files is empty array', async () => {
            const req = makeReq([]);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).toHaveBeenCalledOnce();
        });

        test('calls next() when req.files is undefined', async () => {
            const req = makeReq(undefined);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).toHaveBeenCalledOnce();
        });

        test('clean file → calls next() and does not call removeFile', async () => {
            mocks.isInfected.mockResolvedValue({ isInfected: false, viruses: [] });

            const req = makeReq([{ path: '/tmp/file.txt', originalname: 'file.txt' }]);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).toHaveBeenCalledOnce();
            expect(mocks.removeFile).not.toHaveBeenCalled();
        });

        test('infected file → res.status(422).json(...) with correct shape', async () => {
            mocks.isInfected.mockResolvedValue({ isInfected: true, viruses: ['Eicar-Test-Signature'] });

            const req = makeReq([{ path: '/tmp/file.txt', originalname: 'file.txt' }]);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'File rejected: malware detected',
                detail: {
                    filename: 'file.txt',
                    threats: ['Eicar-Test-Signature'],
                },
            });
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/file.txt');
            expect(mocks.apiLogger.warn).toHaveBeenCalled();
        });

        test('infected file → removeFile called for every file in the request (multi-file quarantine)', async () => {
            mocks.isInfected
                .mockResolvedValueOnce({ isInfected: false, viruses: [] })
                .mockResolvedValueOnce({ isInfected: true, viruses: ['Eicar-Test-Signature'] })
                .mockResolvedValueOnce({ isInfected: false, viruses: [] });

            const files = [
                { path: '/tmp/file1.txt', originalname: 'file1.txt' },
                { path: '/tmp/file2.txt', originalname: 'file2.txt' },
                { path: '/tmp/file3.txt', originalname: 'file3.txt' },
            ];
            const req = makeReq(files);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(next).not.toHaveBeenCalled();
            expect(mocks.removeFile).toHaveBeenCalledTimes(3);
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/file1.txt');
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/file2.txt');
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/file3.txt');
        });

        test('clamd connection error → res.status(503).json(...) and removes all files', async () => {
            mocks.isInfected.mockRejectedValue(new Error('Connection refused'));

            const files = [
                { path: '/tmp/a.txt', originalname: 'a.txt' },
                { path: '/tmp/b.txt', originalname: 'b.txt' },
            ];
            const req = makeReq(files);
            const res = makeRes();
            const next = vi.fn();

            await scanUpload(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Antivirus scan unavailable, upload rejected',
            });
            expect(mocks.removeFile).toHaveBeenCalledTimes(2);
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/a.txt');
            expect(mocks.removeFile).toHaveBeenCalledWith('/tmp/b.txt');
            expect(mocks.errorLogger.error).toHaveBeenCalled();
        });
    });
});
