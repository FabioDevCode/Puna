import { z } from 'zod';
import { hasScope, mcpResponse } from '../helpers/index.js';
import { getMcpStatsSubmission, getMcpStatsHeatmap, getMcpStatsTopSite, getMcpStatsTopForm, getMcpStatsSummary } from '../services/stats.js';

const daysSchema = z.number().int().min(1).max(180).optional().describe('Période en jours (min : 1, max : 180, défaut : 7)');

const registerStatsTools = (server, mcpUser) => {
    const { scope, userId, userRole } = mcpUser;

    if (hasScope(scope, ['read'])) {
        server.tool('get_stats_submission', 'Récupère le nombre de soumissions par jour sur une période', { days: daysSchema }, async ({ days = 7 }) => {
            const result = await getMcpStatsSubmission(userId, days);
            return mcpResponse(result);
        });

        server.tool('get_stats_heatmap', 'Récupère la heatmap des soumissions (jour de semaine × heure)', { days: daysSchema }, async ({ days = 7 }) => {
            const result = await getMcpStatsHeatmap(userId, userRole, days);
            return mcpResponse(result);
        });

        server.tool('get_stats_top_site', 'Récupère les sites avec le plus de soumissions sur une période', { days: daysSchema }, async ({ days = 7 }) => {
            const result = await getMcpStatsTopSite(userId, days);
            return mcpResponse(result);
        });

        server.tool(
            'get_stats_top_form',
            'Récupère les formulaires avec le plus de soumissions sur une période',
            {
                days: daysSchema,
                limit: z.number().int().min(1).max(20).optional().describe('Nombre de résultats (défaut : 5, max : 20)'),
            },
            async ({ days = 7, limit = 5 }) => {
                const result = await getMcpStatsTopForm(userId, days, limit);
                return mcpResponse(result);
            }
        );

        server.tool('get_stats_summary', 'Récupère un résumé global : nombre de sites, formulaires, soumissions totales, du jour et des 7 derniers jours', {}, async () => {
            const result = await getMcpStatsSummary(userId, userRole);
            return mcpResponse(result);
        });
    }
};

export { registerStatsTools };
