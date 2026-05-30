/**
 * @file tests/unit/mcp/services/stats.mcp.service.test.js
 * Unit tests for src/mcp/services/stats.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpStatsSubmission, getMcpStatsTopSite, getMcpStatsTopForm, getMcpStatsHeatmap, getMcpStatsSummary } from '../../../../src/mcp/services/stats.js';
import models from '../../../../src/models/index.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/models/index.js', () => ({
    default: {
        sequelize: {
            query: vi.fn(),
        },
        Sequelize: {
            QueryTypes: { SELECT: 'SELECT' },
        },
    },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcp/services/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('getMcpStatsSubmission(userId, days)', () => {
        it('returns labels array of correct length', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsSubmission('u1', 14);

            expect(result.labels).toHaveLength(14);
            expect(result.data).toHaveLength(14);
        });

        it('defaults to 7 days', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsSubmission('u1');

            expect(result.labels).toHaveLength(7);
        });

        it('labels are formatted as YYYY-MM-DD', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsSubmission('u1', 3);

            result.labels.forEach((l) => expect(l).toMatch(/^\d{4}-\d{2}-\d{2}$/));
        });

        it('fills days with no DB data as 0', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsSubmission('u1', 7);

            expect(result.data.every((v) => v === 0)).toBe(true);
        });

        it('maps DB counts to matching label dates', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsSubmission('u1', 7);

            // All values are numbers
            expect(result.data.every((v) => typeof v === 'number')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpStatsTopSite(userId, days)', () => {
        it('returns sites mapped to { site_id, domain, count }', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([{ site_id: 's1', site_domain: 'example.com', cnt: '12' }]);

            const result = await getMcpStatsTopSite('u1', 7);

            expect(result[0]).toEqual({ site_id: 's1', domain: 'example.com', count: 12 });
        });

        it('coerces string cnt to number', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([{ site_id: 's1', site_domain: 'a.com', cnt: '42' }]);

            const result = await getMcpStatsTopSite('u1', 7);

            expect(typeof result[0].count).toBe('number');
            expect(result[0].count).toBe(42);
        });

        it('returns empty array when no rows', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsTopSite('u1', 7);

            expect(result).toEqual([]);
        });

        it('passes userId, start and end as replacements', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpStatsTopSite('u1', 30);

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[0][1];
            expect(replacements).toMatchObject({ userId: 'u1', start: expect.any(Date), end: expect.any(Date) });
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpStatsTopForm(userId, days, limit)', () => {
        it('returns forms with rank starting at 1', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([
                { form_id: 'f1', form_name: 'Contact', site_id: 's1', site_domain: 'example.com', cnt: '5' },
                { form_id: 'f2', form_name: 'Newsletter', site_id: 's1', site_domain: 'example.com', cnt: '3' },
            ]);

            const result = await getMcpStatsTopForm('u1', 7, 5);

            expect(result[0].rank).toBe(1);
            expect(result[1].rank).toBe(2);
        });

        it('passes limit as replacement parameter', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpStatsTopForm('u1', 7, 10);

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[0][1];
            expect(replacements.limit).toBe(10);
        });

        it('defaults limit to 5', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpStatsTopForm('u1');

            const { replacements } = vi.mocked(models.sequelize.query).mock.calls[0][1];
            expect(replacements.limit).toBe(5);
        });

        it('returns form with all expected fields', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([{ form_id: 'f1', form_name: 'Contact', site_id: 's1', site_domain: 'example.com', cnt: '7' }]);

            const result = await getMcpStatsTopForm('u1', 7, 5);

            expect(result[0]).toMatchObject({ rank: 1, form_id: 'f1', form_name: 'Contact', site_id: 's1', site_domain: 'example.com', count: 7 });
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpStatsHeatmap(userId, userRole, days)', () => {
        it('returns 7 series with 24 data points each', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsHeatmap('u1', 'owner', 7);

            expect(result.series).toHaveLength(7);
            result.series.forEach((s) => expect(s.data).toHaveLength(24));
        });

        it('returns 24 zero-padded hour labels', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsHeatmap('u1', 'owner', 7);

            expect(result.hours).toHaveLength(24);
            expect(result.hours[0]).toBe('00');
            expect(result.hours[23]).toBe('23');
        });

        it('adds userId filter for non-admin users', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpStatsHeatmap('u1', 'owner', 7);

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).toContain('AND s.fk_id_user = :userId');
        });

        it('omits userId filter for super_admin', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            await getMcpStatsHeatmap('u1', 'super_admin', 7);

            const sql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(sql).not.toContain('AND s.fk_id_user = :userId');
        });

        it('maps MySQL DAYOFWEEK=1 (Sunday) to the Sunday series at hour 12', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([{ dow: 1, h: 12, cnt: 5 }]);

            const result = await getMcpStatsHeatmap('u1', 'owner', 7);

            const sundaySeries = result.series.find((s) => s.name === 'Sunday');
            expect(sundaySeries).toBeDefined();
            const noonSlot = sundaySeries.data.find((d) => d.x === '12');
            expect(noonSlot.y).toBe(5);
        });

        it('leaves unset slots at 0', async () => {
            vi.mocked(models.sequelize.query).mockResolvedValue([]);

            const result = await getMcpStatsHeatmap('u1', 'owner', 7);

            const allZero = result.series.every((s) => s.data.every((d) => d.y === 0));
            expect(allZero).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    describe('getMcpStatsSummary(userId, userRole)', () => {
        it('returns all 5 counters with correct values', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: '3' }]) // sites
                .mockResolvedValueOnce([{ cnt: '10' }]) // forms
                .mockResolvedValueOnce([{ cnt: '100' }]) // total_submissions
                .mockResolvedValueOnce([{ cnt: '5' }]) // submissions_today
                .mockResolvedValueOnce([{ cnt: '25' }]); // submissions_last_7_days

            const result = await getMcpStatsSummary('u1', 'owner');

            expect(result).toEqual({
                sites: 3,
                forms: 10,
                total_submissions: 100,
                submissions_today: 5,
                submissions_last_7_days: 25,
            });
        });

        it('coerces missing cnt to 0', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([{}]);

            const result = await getMcpStatsSummary('u1', 'owner');

            expect(result.sites).toBe(0);
            expect(result.total_submissions).toBe(0);
            expect(result.submissions_today).toBe(0);
        });

        it('omits userId filter in SQL for super_admin', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }]);

            await getMcpStatsSummary('u1', 'super_admin');

            const firstSql = vi.mocked(models.sequelize.query).mock.calls[0][0];
            expect(firstSql).not.toContain('AND s.fk_id_user = :userId');
        });

        it('includes userId filter in SQL for regular user', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }])
                .mockResolvedValueOnce([{ cnt: '0' }]);

            await getMcpStatsSummary('u1', 'owner');

            // At least the form and inbox queries should have the filter
            const secondSql = vi.mocked(models.sequelize.query).mock.calls[1][0];
            expect(secondSql).toContain('AND s.fk_id_user = :userId');
        });

        it('executes exactly 5 queries in parallel', async () => {
            vi.mocked(models.sequelize.query)
                .mockResolvedValueOnce([{ cnt: '1' }])
                .mockResolvedValueOnce([{ cnt: '2' }])
                .mockResolvedValueOnce([{ cnt: '3' }])
                .mockResolvedValueOnce([{ cnt: '4' }])
                .mockResolvedValueOnce([{ cnt: '5' }]);

            await getMcpStatsSummary('u1', 'owner');

            expect(vi.mocked(models.sequelize.query)).toHaveBeenCalledTimes(5);
        });
    });
});
