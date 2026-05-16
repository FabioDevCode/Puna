import { z } from 'zod';
import { checkSiteAccess, checkFormAccess } from '../../services/access.service.js';
import { hasScope, mcpResponse, mcpError } from '../helpers/index.js';
import { getMcpForms, getMcpFormDetails } from '../services/form.js';

const registerFormTools = (server, mcpUser) => {
    const { scope, userId, userRole } = mcpUser;

    if (hasScope(scope, ['read'])) {
        server.tool(
            'get_forms',
            "Liste tous les formulaires d'un site web",
            {
                site_id: z.string().describe('Identifiant du site web'),
            },
            async ({ site_id }) => {
                const allowed = await checkSiteAccess(site_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const forms = await getMcpForms(site_id);
                return mcpResponse(forms);
            }
        );

        server.tool(
            'get_form_details',
            "Récupère les colonnes, métadonnées et statistiques d'un formulaire",
            {
                form_id: z.string().describe('Identifiant du formulaire'),
            },
            async ({ form_id }) => {
                const allowed = await checkFormAccess(form_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const result = await getMcpFormDetails(form_id);
                if (!result) return mcpError('Form not found');

                return mcpResponse(result);
            }
        );
    }
};

export { registerFormTools };
