import { z } from 'zod';
import { hasScope, mcpResponse } from '../helpers/index.js';
import { getMcpStatsSubmission, getMcpStatsHeatmap, getMcpStatsTopSite, getMcpStatsTopForm } from '../services/stats.js';

const daysSchema = z
    .union([z.literal(7), z.literal(30)])
    .optional()
    .describe('Période en jours (7 ou 30, défaut : 7)');

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

        server.tool('get_stats_top_site', 'Récupère les sites avec le plus de soumissions', {}, async () => {
            const result = await getMcpStatsTopSite(userId);
            return mcpResponse(result);
        });

        server.tool('get_stats_top_form', 'Récupère les formulaires avec le plus de soumissions sur une période', { days: daysSchema }, async ({ days = 7 }) => {
            const result = await getMcpStatsTopForm(userId, days);
            return mcpResponse(result);
        });
    }
};

export { registerStatsTools };
