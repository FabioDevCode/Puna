import { z } from 'zod';
import { hasScope } from '../helpers/index.js';

const registerSiteTools = (server, mcpUser) => {
    const { scope, userId } = mcpUser;

    if (hasScope(scope, ['read', 'read_write', 'read_write_access'])) {
        server.tool('get_sites', "Liste tous les sites web de l'utilisateur", {}, async () => {
            return {
                content: [{ type: 'text', text: JSON.stringify([]) }],
            };
        });
    }

    if (hasScope(scope, ['read_write', 'read_write_access'])) {
        server.tool(
            'create_site',
            'Crée un nouveau site web',
            {
                domain: z.string().describe('Domaine ou nom du site'),
            },
            async ({ domain }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify({}) }],
                };
            }
        );
    }

    if (hasScope(scope, ['read_write_access'])) {
        server.tool(
            'get_site_token',
            "Récupère le token d'un site web",
            {
                site_id: z.string().describe('Identifiant du site'),
            },
            async ({ site_id }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify({}) }],
                };
            }
        );

        server.tool(
            'revoke_site_token',
            "Révoque le token d'un site web",
            {
                site_id: z.string().describe('Identifiant du site'),
            },
            async ({ site_id }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify({}) }],
                };
            }
        );
    }
};

export { registerSiteTools };
