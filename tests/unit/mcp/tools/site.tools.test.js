/**
 * @file tests/unit/mcp/tools/site.tools.test.js
 * Unit tests for src/mcp/tools/site.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpSites, getMcpSiteDetails } from '../../../../src/mcp/services/site.js';
import { registerSiteTools } from '../../../../src/mcp/tools/site.js';
import { checkSiteAccess } from '../../../../src/services/access.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/mcp/services/site.js', () => ({
    getMcpSites: vi.fn(),
    getMcpSiteDetails: vi.fn(),
}));

vi.mock('../../../../src/services/access.service.js', () => ({
    checkSiteAccess: vi.fn(),
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

describe('mcp/tools/site', () => {
    let server;
    let tools;

    beforeEach(() => {
        vi.clearAllMocks();
        server = makeMockServer();
        registerSiteTools(server, DEFAULT_MCP_USER);
        tools = server._tools;
    });

    // -------------------------------------------------------------------------
    describe('tool registration', () => {
        it('registers both tools when scope is read', () => {
            expect(server.tool).toHaveBeenCalledTimes(2);
            expect(tools).toHaveProperty('get_sites');
            expect(tools).toHaveProperty('get_site_details');
        });

        it('does not register any tool when scope is not read', () => {
            const noReadServer = makeMockServer();
            registerSiteTools(noReadServer, { scope: 'none', userId: 'u1', userRole: 'owner' });
            expect(noReadServer.tool).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('get_sites', () => {
        it('calls getMcpSites with userId and userRole', async () => {
            vi.mocked(getMcpSites).mockResolvedValue([]);

            await tools['get_sites']({});

            expect(getMcpSites).toHaveBeenCalledWith('u1', 'owner');
        });

        it('returns mcpResponse with sites list', async () => {
            vi.mocked(getMcpSites).mockResolvedValue([{ id: 's1', domain: 'example.com' }]);

            const result = await tools['get_sites']({});

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].id).toBe('s1');
        });

        it('returns empty list when user has no sites', async () => {
            vi.mocked(getMcpSites).mockResolvedValue([]);

            const result = await tools['get_sites']({});

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_site_details', () => {
        it('returns error when checkSiteAccess denies access', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(false);

            const result = await tools['get_site_details']({ site_id: 's1' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Access denied');
        });

        it('returns error when site not found', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(true);
            vi.mocked(getMcpSiteDetails).mockResolvedValue(null);

            const result = await tools['get_site_details']({ site_id: 's-missing' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Site not found');
        });

        it('returns mcpResponse with site and forms on success', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(true);
            vi.mocked(getMcpSiteDetails).mockResolvedValue({
                site: { id: 's1', domain: 'example.com' },
                forms: [{ id: 'f1', name: 'Contact', total_submissions: 10 }],
            });

            const result = await tools['get_site_details']({ site_id: 's1' });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.site.id).toBe('s1');
            expect(parsed.forms[0].total_submissions).toBe(10);
        });

        it('calls checkSiteAccess with the correct siteId, userId and userRole', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(false);

            await tools['get_site_details']({ site_id: 's42' });

            expect(checkSiteAccess).toHaveBeenCalledWith('s42', 'u1', 'owner');
        });
    });
});
