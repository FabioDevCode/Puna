import { z } from 'zod';
import { hasScope } from '../helpers/index.js';

const registerFormTools = (server, mcpUser) => {
    const { scope, userId } = mcpUser;

    if (hasScope(scope, ['read', 'read_write', 'read_write_access'])) {
        server.tool(
            'get_forms',
            "Liste tous les formulaires d'un site web",
            {
                site_id: z.string().describe('Identifiant du site web'),
            },
            async ({ website_id }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify([]) }],
                };
            }
        );
    }

    // ── read_write ────────────────────────────────
    if (hasScope(scope, ['read_write', 'read_write_access'])) {
        server.tool(
            'create_form',
            'Crée un nouveau formulaire rattaché à un site web',
            {
                site_id: z.string().describe('Identifiant du site web'),
                name: z.string().describe('Nom du formulaire'),
            },
            async ({ site_id, name }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify({}) }],
                };
            }
        );
    }

    // ── read_write_access ─────────────────────────
    if (hasScope(scope, ['read_write_access'])) {
        server.tool(
            'get_form_code',
            "Récupère le code d'intégration d'un formulaire",
            {
                form_id: z.string().describe('Identifiant du formulaire'),
            },
            async ({ form_id }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify({}) }],
                };
            }
        );
    }
};

export { registerFormTools };
