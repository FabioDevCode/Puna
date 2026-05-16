import { z } from 'zod';
import { checkFormAccess, checkInboxAccess } from '../../services/access.service.js';
import { hasScope, mcpResponse, mcpError } from '../helpers/index.js';
import { getMcpSubmissions, getMcpSubmission } from '../services/inbox.js';

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
            },
            async ({ form_id, page = 1, limit = 50 }) => {
                const allowed = await checkFormAccess(form_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const result = await getMcpSubmissions(form_id, page, limit);
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
    }
};

export { registerInboxTools };
