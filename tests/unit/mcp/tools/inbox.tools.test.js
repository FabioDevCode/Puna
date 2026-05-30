/**
 * @file tests/unit/mcp/tools/inbox.tools.test.js
 * Unit tests for src/mcp/tools/inbox.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpSubmissions, getMcpSubmission, getMcpRecentSubmissions, getMcpSearchSubmissions } from '../../../../src/mcp/services/inbox.js';
import { registerInboxTools } from '../../../../src/mcp/tools/inbox.js';
import { checkFormAccess, checkInboxAccess } from '../../../../src/services/access.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/mcp/services/inbox.js', () => ({
    getMcpSubmissions: vi.fn(),
    getMcpSubmission: vi.fn(),
    getMcpRecentSubmissions: vi.fn(),
    getMcpSearchSubmissions: vi.fn(),
}));

vi.mock('../../../../src/services/access.service.js', () => ({
    checkFormAccess: vi.fn(),
    checkInboxAccess: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockServer() {
    const registeredTools = {};
    const server = {
        tool: vi.fn((name, _desc, _schema, handler) => {
            registeredTools[name] = handler;
        }),
        _tools: registeredTools,
    };
    return server;
}

const DEFAULT_MCP_USER = { scope: 'read', userId: 'u1', userRole: 'owner' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcp/tools/inbox', () => {
    let server;
    let tools;

    beforeEach(() => {
        vi.clearAllMocks();
        server = makeMockServer();
        registerInboxTools(server, DEFAULT_MCP_USER);
        tools = server._tools;
    });

    // -------------------------------------------------------------------------
    describe('tool registration', () => {
        it('registers all 4 tools when scope is read', () => {
            expect(server.tool).toHaveBeenCalledTimes(4);
            expect(tools).toHaveProperty('get_submissions');
            expect(tools).toHaveProperty('get_submission');
            expect(tools).toHaveProperty('get_recent_submissions');
            expect(tools).toHaveProperty('search_submissions');
        });

        it('does not register any tool when scope is not read', () => {
            const noReadServer = makeMockServer();
            registerInboxTools(noReadServer, { scope: 'write', userId: 'u1', userRole: 'owner' });
            expect(noReadServer.tool).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('get_submissions', () => {
        it('returns error when checkFormAccess denies access', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(false);

            const result = await tools['get_submissions']({ form_id: 'f1' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Access denied');
        });

        it('calls getMcpSubmissions with all provided params', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(true);
            vi.mocked(getMcpSubmissions).mockResolvedValue({ submissions: [], total: 0 });

            await tools['get_submissions']({ form_id: 'f1', page: 2, limit: 10, date_from: '2026-05-01', date_to: '2026-05-31' });

            expect(getMcpSubmissions).toHaveBeenCalledWith('f1', 2, 10, '2026-05-01', '2026-05-31');
        });

        it('uses default page=1, limit=50 when not provided', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(true);
            vi.mocked(getMcpSubmissions).mockResolvedValue({ submissions: [], total: 0 });

            await tools['get_submissions']({ form_id: 'f1' });

            expect(getMcpSubmissions).toHaveBeenCalledWith('f1', 1, 50, undefined, undefined);
        });

        it('returns mcpResponse with service data on success', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(true);
            vi.mocked(getMcpSubmissions).mockResolvedValue({ submissions: [{ id: 'sub-1' }], total: 1 });

            const result = await tools['get_submissions']({ form_id: 'f1' });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.total).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_submission', () => {
        it('returns error when checkInboxAccess denies access', async () => {
            vi.mocked(checkInboxAccess).mockResolvedValue(false);

            const result = await tools['get_submission']({ submission_id: 'sub-1' });

            expect(result.isError).toBe(true);
        });

        it('returns error when submission not found', async () => {
            vi.mocked(checkInboxAccess).mockResolvedValue(true);
            vi.mocked(getMcpSubmission).mockResolvedValue(null);

            const result = await tools['get_submission']({ submission_id: 'sub-missing' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Submission not found');
        });

        it('returns mcpResponse on success', async () => {
            vi.mocked(checkInboxAccess).mockResolvedValue(true);
            vi.mocked(getMcpSubmission).mockResolvedValue({ id: 'sub-1', content: { name: 'Alice' } });

            const result = await tools['get_submission']({ submission_id: 'sub-1' });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.id).toBe('sub-1');
        });
    });

    // -------------------------------------------------------------------------
    describe('get_recent_submissions', () => {
        it('calls getMcpRecentSubmissions with userId, userRole and limit', async () => {
            vi.mocked(getMcpRecentSubmissions).mockResolvedValue([]);

            await tools['get_recent_submissions']({ limit: 20 });

            expect(getMcpRecentSubmissions).toHaveBeenCalledWith('u1', 'owner', 20);
        });

        it('uses default limit=10 when not provided', async () => {
            vi.mocked(getMcpRecentSubmissions).mockResolvedValue([]);

            await tools['get_recent_submissions']({});

            expect(getMcpRecentSubmissions).toHaveBeenCalledWith('u1', 'owner', 10);
        });

        it('returns mcpResponse with the submissions list', async () => {
            vi.mocked(getMcpRecentSubmissions).mockResolvedValue([{ id: 'sub-1' }]);

            const result = await tools['get_recent_submissions']({});

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('search_submissions', () => {
        it('calls getMcpSearchSubmissions with correct params', async () => {
            vi.mocked(getMcpSearchSubmissions).mockResolvedValue({ submissions: [], total: 0 });

            await tools['search_submissions']({ query: 'urgent', page: 2, limit: 15 });

            expect(getMcpSearchSubmissions).toHaveBeenCalledWith('u1', 'owner', 'urgent', 2, 15);
        });

        it('uses default page=1 and limit=20 when not provided', async () => {
            vi.mocked(getMcpSearchSubmissions).mockResolvedValue({ submissions: [], total: 0 });

            await tools['search_submissions']({ query: 'hello' });

            expect(getMcpSearchSubmissions).toHaveBeenCalledWith('u1', 'owner', 'hello', 1, 20);
        });

        it('returns mcpResponse with search results', async () => {
            vi.mocked(getMcpSearchSubmissions).mockResolvedValue({ submissions: [{ id: 's1' }], total: 1 });

            const result = await tools['search_submissions']({ query: 'test' });

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.total).toBe(1);
        });
    });
});
