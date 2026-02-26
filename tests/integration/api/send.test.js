/**
 * @file tests/integration/api/send.test.js
 * Integration tests for POST /api/v1/send/:code
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import defaultRouter from '../../../src/api/v1/default.api.js';
import models from '../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

// Prevent logger from writing to disk or scheduling cron jobs
vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn().mockResolvedValue(undefined),
    formatBytes: vi.fn((b) => `${b} B`),
}));

// Bypass AES key-length validation in crypto.js (throws at module load if KEV/KIV absent)
vi.mock('../../../src/utils/crypto.js', () => ({
    encryptObject: vi.fn(() => 'mock-encrypted'),
    decryptObject: vi.fn(() => ({ id: 'test-site-id', control_code: 'test-control-code' })),
    encryptString: vi.fn(() => 'mock-encrypted-str'),
    decryptString: vi.fn(() => 'mock-decrypted-str'),
}));

// Replace database models to avoid a real MariaDB connection
vi.mock('../../../src/models/index.js', () => ({
    default: {
        Site: { findOne: vi.fn() },
        Form: { findOne: vi.fn(), findByPk: vi.fn() },
        Inbox: { create: vi.fn() },
        User: {
            findOne: vi.fn(),
            findByPk: vi.fn(),
            count: vi.fn().mockResolvedValue(1),
            create: vi.fn(),
        },
        sequelize: { sync: vi.fn().mockResolvedValue(undefined) },
        Sequelize: {},
        Op: {},
    },
}));

// ---------------------------------------------------------------------------
// Environment variables — read at runtime inside middleware functions
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key-puna-integration-v1';
process.env.KEY_TK = 'test-jwt-secret-key-minimum-32-chars!!';
process.env.KEV = 'a'.repeat(64); // valid 64-char hex (32 bytes)
process.env.KIV = 'b'.repeat(32); // valid 32-char hex (16 bytes)
process.env.LOG_TO_CONSOLE = 'false';
// Keep uploads under the project storage dir so fs.rename stays on the same device
process.env.UPLOADS_DIR = path.join(process.cwd(), 'storage', 'test-uploads');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const TEST_API_KEY = process.env.API_KEY;
const TEST_JWT_SECRET = process.env.KEY_TK;

const mockSite = {
    id: 'test-site-id',
    control_code: 'test-control-code',
    domain: 'test.example.com',
};

const mockForm = {
    id: 'test-form-id',
    code: 'TEST001',
    name: 'Test_Form',
    fk_id_site: 'test-site-id',
    template: null,
    columns: null,
    file_keys: null,
};

// JWT whose `data` field is passed through the mocked decryptObject
const validBearerToken = `Bearer ${jwt.sign({ data: 'mock-encrypted-site-payload' }, TEST_JWT_SECRET)}`;

function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1', defaultRouter);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/v1/send/:code', () => {
    let app;
    const testTmpDir = path.join(process.cwd(), 'storage', 'test-uploads');

    beforeAll(() => {
        fs.mkdirSync(testTmpDir, { recursive: true });
        app = buildTestApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(models.Site.findOne).mockResolvedValue(mockSite);
        vi.mocked(models.Form.findOne).mockResolvedValue(mockForm);
        vi.mocked(models.Form.findByPk).mockResolvedValue({
            ...mockForm,
            update: vi.fn().mockResolvedValue(undefined),
        });
        vi.mocked(models.Inbox.create).mockResolvedValue({
            id: 'inbox-entry-id',
            content: '{}',
            fk_id_form: 'test-form-id',
        });
    });

    afterAll(() => {
        try {
            fs.rmSync(testTmpDir, { recursive: true, force: true });
        } catch {
            // best-effort cleanup
        }
    });

    // -----------------------------------------------------------------------
    describe('Authentication — x-key-puna header', () => {
        it('returns 401 when x-key-puna header is absent', async () => {
            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('Authorization', validBearerToken)
                .send({ name: 'Test' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('returns 401 when x-key-puna header is invalid', async () => {
            const wrongKey = 'X'.repeat(TEST_API_KEY.length);

            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', wrongKey)
                .set('Authorization', validBearerToken)
                .send({ name: 'Test' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });
    });

    // -----------------------------------------------------------------------
    describe('Authentication — Bearer token', () => {
        it('returns 401 when Authorization header is absent', async () => {
            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .send({ name: 'Test' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('returns 401 when Bearer token is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', 'Bearer invalid.jwt.token')
                .send({ name: 'Test' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });
    });

    // -----------------------------------------------------------------------
    describe('Form lookup', () => {
        it('returns 404 when form code does not exist', async () => {
            vi.mocked(models.Form.findOne).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/v1/send/UNKNOWN')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', validBearerToken)
                .send({ name: 'Test' });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error');
        });
    });

    // -----------------------------------------------------------------------
    describe('Valid JSON requests', () => {
        it('returns 200 and persists data to inbox when request is valid', async () => {
            const payload = { name: 'Alice', email: 'alice@example.com', message: 'Hello!' };

            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', validBearerToken)
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(models.Inbox.create).toHaveBeenCalledOnce();
            expect(models.Inbox.create).toHaveBeenCalledWith(expect.objectContaining({ fk_id_form: 'test-form-id' }));
        });

        it('returns 200 with empty body (accepted)', async () => {
            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', validBearerToken)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });

    // -----------------------------------------------------------------------
    describe('File uploads', () => {
        it('rejects a file with forbidden extension (.exe)', async () => {
            const fakeExe = path.join(testTmpDir, 'malware.exe');
            fs.writeFileSync(fakeExe, Buffer.alloc(64, 0x4d));

            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', validBearerToken)
                .attach('file', fakeExe, { filename: 'malware.exe' });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/extension not allowed/i);
        });

        it('accepts and processes a valid .txt file upload', async () => {
            const txtFile = path.join(testTmpDir, 'document.txt');
            fs.writeFileSync(txtFile, 'This is a test document.\n');

            const res = await request(app)
                .post('/api/v1/send/TEST001')
                .set('x-key-puna', TEST_API_KEY)
                .set('Authorization', validBearerToken)
                .attach('file', txtFile, { filename: 'document.txt' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });
});
