import { z } from 'zod';
import { checkSiteAccess } from '../../services/access.service.js';
import { hasScope, mcpResponse, mcpError } from '../helpers/index.js';
import { getMcpSites, getMcpSiteDetails } from '../services/site.js';

const registerSiteTools = (server, mcpUser) => {
    const { scope, userId, userRole } = mcpUser;

    if (hasScope(scope, ['read'])) {
        server.tool('get_sites', "Liste tous les sites web de l'utilisateur", {}, async () => {
            const sites = await getMcpSites(userId, userRole);
            return mcpResponse(sites);
        });

        server.tool(
            'get_site_details',
            "Récupère les données d'un site ainsi que la liste des formulaires associés",
            {
                site_id: z.string().describe('Identifiant du site'),
            },
            async ({ site_id }) => {
                const allowed = await checkSiteAccess(site_id, userId, userRole);
                if (!allowed) return mcpError('Access denied');

                const result = await getMcpSiteDetails(site_id);
                if (!result) return mcpError('Site not found');

                return mcpResponse(result);
            }
        );
    }
};

export { registerSiteTools };
