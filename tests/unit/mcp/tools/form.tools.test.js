/**
 * @file tests/unit/mcp/tools/form.tools.test.js
 * Unit tests for src/mcp/tools/form.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpForms, getMcpFormDetails } from '../../../../src/mcp/services/form.js';
import { registerFormTools } from '../../../../src/mcp/tools/form.js';
import { checkSiteAccess, checkFormAccess } from '../../../../src/services/access.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/mcp/services/form.js', () => ({
    getMcpForms: vi.fn(),
    getMcpFormDetails: vi.fn(),
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

describe('mcp/tools/form', () => {
    let server;
    let tools;

    beforeEach(() => {
        vi.clearAllMocks();
        server = makeMockServer();
        registerFormTools(server, DEFAULT_MCP_USER);
        tools = server._tools;
    });

    // -------------------------------------------------------------------------
    describe('tool registration', () => {
        it('registers both tools when scope is read', () => {
            expect(server.tool).toHaveBeenCalledTimes(2);
            expect(tools).toHaveProperty('get_forms');
            expect(tools).toHaveProperty('get_form_details');
        });

        it('does not register any tool when scope is not read', () => {
            const noReadServer = makeMockServer();
            registerFormTools(noReadServer, { scope: 'none', userId: 'u1', userRole: 'owner' });
            expect(noReadServer.tool).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('get_forms', () => {
        it('returns error when checkSiteAccess denies access', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(false);

            const result = await tools['get_forms']({ site_id: 's1' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Access denied');
        });

        it('calls getMcpForms with the site_id', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(true);
            vi.mocked(getMcpForms).mockResolvedValue([]);

            await tools['get_forms']({ site_id: 's1' });

            expect(getMcpForms).toHaveBeenCalledWith('s1');
        });

        it('returns mcpResponse with forms list on success', async () => {
            vi.mocked(checkSiteAccess).mockResolvedValue(true);
            vi.mocked(getMcpForms).mockResolvedValue([{ id: 'f1', name: 'Contact' }]);

            const result = await tools['get_forms']({ site_id: 's1' });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].id).toBe('f1');
        });
    });

    // -------------------------------------------------------------------------
    describe('get_form_details', () => {
        it('returns error when checkFormAccess denies access', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(false);

            const result = await tools['get_form_details']({ form_id: 'f1' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Access denied');
        });

        it('returns error when form not found', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(true);
            vi.mocked(getMcpFormDetails).mockResolvedValue(null);

            const result = await tools['get_form_details']({ form_id: 'f-missing' });

            expect(result.isError).toBe(true);
            expect(JSON.parse(result.content[0].text).error).toBe('Form not found');
        });

        it('returns mcpResponse with form details on success', async () => {
            vi.mocked(checkFormAccess).mockResolvedValue(true);
            vi.mocked(getMcpFormDetails).mockResolvedValue({
                id: 'f1',
                name: 'Contact',
                columns: ['email'],
                columns_labels: { email: 'Email' },
                file_keys: null,
                has_files: false,
                total_submissions: 5,
            });

            const result = await tools['get_form_details']({ form_id: 'f1' });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.id).toBe('f1');
            expect(parsed.total_submissions).toBe(5);
        });
    });
});
