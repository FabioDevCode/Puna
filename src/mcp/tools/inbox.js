import { z } from 'zod';
import { hasScope } from '../helpers/index.js';

const registerInboxTools = (server, mcpUser) => {
    const { scope, userId } = mcpUser;

    if (hasScope(scope, ['read', 'read_write', 'read_write_access'])) {
        server.tool(
            'get_submissions',
            'Liste les soumissions reçues pour un formulaire',
            {
                form_id: z.string().describe('Identifiant du formulaire'),
                limit: z.number().optional().describe('Nombre maximum de résultats à retourner'),
            },
            async ({ form_id, limit }) => {
                return {
                    content: [{ type: 'text', text: JSON.stringify([]) }],
                };
            }
        );
    }
};

export { registerInboxTools };
