import { z } from 'zod';
import { checkFormAccess, checkInboxAccess } from '../../services/access.service.js';
import { hasScope, mcpResponse, mcpError } from '../helpers/index.js';
import { getMcpSubmissions, getMcpSubmission, getMcpRecentSubmissions, getMcpSearchSubmissions } from '../services/inbox.js';

const registerInboxTools = (server, mcpUser) => {
    const { scope, userId, userRole } = mcpUser;

    if (hasScope(scope, ['read'])) {
        server.tool(
            'get_submissions',
            'Liste les soumissions reçues pour un formulaire',
            {
                form_id: z.string().describe('Identifiant du formulaire'),
                page: z.number().int().min(1).optional().describe('Numéro de page (défaut : 1)'),
                limit: z.number().int().min(1).max(100).optional().describe('Résultats par page (défaut : 50, max : 100)'),
                date_from: z.string().date().optional().describe('Date de début (format YYYY-MM-DD, incluse)'),
                date_to: z.string().date().optional().describe('Date de fin (format YYYY-MM-DD, incluse)'),
            },
            async ({ form_id, page = 1, limit = 50, date_from, date_to }) => {
                const allowed = await checkFormAccess(form_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const result = await getMcpSubmissions(form_id, page, limit, date_from, date_to);
                return mcpResponse(result);
            }
        );

        server.tool(
            'get_submission',
            "Récupère les données d'une soumission par son identifiant",
            {
                submission_id: z.string().describe('Identifiant de la soumission'),
            },
            async ({ submission_id }) => {
                const allowed = await checkInboxAccess(submission_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const submission = await getMcpSubmission(submission_id);
                if (!submission) return mcpError('Submission not found');

                return mcpResponse(submission);
            }
        );

        server.tool(
            'get_recent_submissions',
            'Récupère les dernières soumissions reçues tous formulaires et sites confondus',
            {
                limit: z.number().int().min(1).max(50).optional().describe('Nombre de soumissions à retourner (défaut : 10, max : 50)'),
            },
            async ({ limit = 10 }) => {
                const result = await getMcpRecentSubmissions(userId, userRole, limit);
                return mcpResponse(result);
            }
        );

        server.tool(
            'search_submissions',
            'Recherche dans le contenu des soumissions via un mot-clé',
            {
                query: z.string().min(1).describe('Terme à rechercher dans le contenu des soumissions'),
                page: z.number().int().min(1).optional().describe('Numéro de page (défaut : 1)'),
                limit: z.number().int().min(1).max(100).optional().describe('Résultats par page (défaut : 20, max : 100)'),
            },
            async ({ query, page = 1, limit = 20 }) => {
                const result = await getMcpSearchSubmissions(userId, userRole, query, page, limit);
                return mcpResponse(result);
            }
        );
    }
};

export { registerInboxTools };
