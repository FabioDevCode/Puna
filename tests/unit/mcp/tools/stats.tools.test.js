/**
 * @file tests/unit/mcp/tools/stats.tools.test.js
 * Unit tests for src/mcp/tools/stats.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpStatsSubmission, getMcpStatsHeatmap, getMcpStatsTopSite, getMcpStatsTopForm, getMcpStatsSummary } from '../../../../src/mcp/services/stats.js';
import { registerStatsTools } from '../../../../src/mcp/tools/stats.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/mcp/services/stats.js', () => ({
    getMcpStatsSubmission: vi.fn(),
    getMcpStatsHeatmap: vi.fn(),
    getMcpStatsTopSite: vi.fn(),
    getMcpStatsTopForm: vi.fn(),
    getMcpStatsSummary: vi.fn(),
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

describe('mcp/tools/stats', () => {
    let server;
    let tools;

    beforeEach(() => {
        vi.clearAllMocks();
        server = makeMockServer();
        registerStatsTools(server, DEFAULT_MCP_USER);
        tools = server._tools;
    });

    // -------------------------------------------------------------------------
    describe('tool registration', () => {
        it('registers all 5 tools when scope is read', () => {
            expect(server.tool).toHaveBeenCalledTimes(5);
            expect(tools).toHaveProperty('get_stats_submission');
            expect(tools).toHaveProperty('get_stats_heatmap');
            expect(tools).toHaveProperty('get_stats_top_site');
            expect(tools).toHaveProperty('get_stats_top_form');
            expect(tools).toHaveProperty('get_stats_summary');
        });

        it('does not register any tool when scope is not read', () => {
            const noReadServer = makeMockServer();
            registerStatsTools(noReadServer, { scope: 'none', userId: 'u1', userRole: 'owner' });
            expect(noReadServer.tool).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('get_stats_submission', () => {
        it('calls service with userId and provided days', async () => {
            vi.mocked(getMcpStatsSubmission).mockResolvedValue({ labels: [], data: [] });

            await tools['get_stats_submission']({ days: 30 });

            expect(getMcpStatsSubmission).toHaveBeenCalledWith('u1', 30);
        });

        it('defaults days to 7', async () => {
            vi.mocked(getMcpStatsSubmission).mockResolvedValue({ labels: [], data: [] });

            await tools['get_stats_submission']({});

            expect(getMcpStatsSubmission).toHaveBeenCalledWith('u1', 7);
        });

        it('returns mcpResponse with service data', async () => {
            vi.mocked(getMcpStatsSubmission).mockResolvedValue({ labels: ['2026-05-30'], data: [3] });

            const result = await tools['get_stats_submission']({});

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.data).toEqual([3]);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_stats_heatmap', () => {
        it('calls service with userId, userRole and days', async () => {
            vi.mocked(getMcpStatsHeatmap).mockResolvedValue({ hours: [], series: [] });

            await tools['get_stats_heatmap']({ days: 14 });

            expect(getMcpStatsHeatmap).toHaveBeenCalledWith('u1', 'owner', 14);
        });

        it('defaults days to 7', async () => {
            vi.mocked(getMcpStatsHeatmap).mockResolvedValue({ hours: [], series: [] });

            await tools['get_stats_heatmap']({});

            expect(getMcpStatsHeatmap).toHaveBeenCalledWith('u1', 'owner', 7);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_stats_top_site', () => {
        it('calls service with userId and days', async () => {
            vi.mocked(getMcpStatsTopSite).mockResolvedValue([]);

            await tools['get_stats_top_site']({ days: 30 });

            expect(getMcpStatsTopSite).toHaveBeenCalledWith('u1', 30);
        });

        it('defaults days to 7', async () => {
            vi.mocked(getMcpStatsTopSite).mockResolvedValue([]);

            await tools['get_stats_top_site']({});

            expect(getMcpStatsTopSite).toHaveBeenCalledWith('u1', 7);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_stats_top_form', () => {
        it('calls service with userId, days and limit', async () => {
            vi.mocked(getMcpStatsTopForm).mockResolvedValue([]);

            await tools['get_stats_top_form']({ days: 14, limit: 10 });

            expect(getMcpStatsTopForm).toHaveBeenCalledWith('u1', 14, 10);
        });

        it('defaults days to 7 and limit to 5', async () => {
            vi.mocked(getMcpStatsTopForm).mockResolvedValue([]);

            await tools['get_stats_top_form']({});

            expect(getMcpStatsTopForm).toHaveBeenCalledWith('u1', 7, 5);
        });

        it('returns ranked forms in response', async () => {
            vi.mocked(getMcpStatsTopForm).mockResolvedValue([{ rank: 1, form_name: 'Contact', count: 10 }]);

            const result = await tools['get_stats_top_form']({});

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed[0].rank).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('get_stats_summary', () => {
        it('calls service with userId and userRole', async () => {
            vi.mocked(getMcpStatsSummary).mockResolvedValue({ sites: 2, forms: 5, total_submissions: 100, submissions_today: 3, submissions_last_7_days: 20 });

            await tools['get_stats_summary']({});

            expect(getMcpStatsSummary).toHaveBeenCalledWith('u1', 'owner');
        });

        it('returns all 5 counters in response', async () => {
            vi.mocked(getMcpStatsSummary).mockResolvedValue({
                sites: 2,
                forms: 5,
                total_submissions: 100,
                submissions_today: 3,
                submissions_last_7_days: 20,
            });

            const result = await tools['get_stats_summary']({});

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toMatchObject({
                sites: 2,
                forms: 5,
                total_submissions: 100,
                submissions_today: 3,
                submissions_last_7_days: 20,
            });
        });
    });
});
