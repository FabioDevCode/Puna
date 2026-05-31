import crypto from 'node:crypto';
import models from '../../models/index.js';
import { mcpLogger } from '../logger.js';

const hashApiKey = (apiKey) => {
    return crypto.createHmac('sha256', process.env.MCP_HASH_SECRET).update(apiKey).digest('hex');
};

const mcpAuth = async (req, res, next) => {
    // 1. MCP activé globalement ?
    if (process.env.MCP_ENABLED !== 'true') {
        mcpLogger.warn({ ip: req.ip, reason: 'mcp_disabled' }, 'MCP request rejected');
        return res.status(503).json({ error: 'MCP service is disabled' });
    }

    // 2. Clé présente dans le header ?
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        mcpLogger.warn({ ip: req.ip, reason: 'missing_api_key' }, 'MCP request rejected');
        return res.status(401).json({ error: 'Missing API key' });
    }

    const apiKey = authHeader.split(' ')[1];

    // 3. Hash de la clé reçue
    const keyHash = hashApiKey(apiKey);

    // 4. Recherche en base
    const keyData = await models.Mcp_keys.findOne({
        raw: true,
        where: {
            key_hash: keyHash,
        },
    });

    if (!keyData) {
        mcpLogger.warn({ ip: req.ip, reason: 'invalid_api_key' }, 'MCP request rejected');
        return res.status(401).json({ error: 'Invalid API key' });
    }

    // 5. MCP activé pour cet utilisateur ?
    if (!keyData.is_active) {
        mcpLogger.warn({ ip: req.ip, userId: keyData.fk_id_user, reason: 'mcp_key_disabled' }, 'MCP request rejected');
        return res.status(403).json({ error: 'MCP access not enabled for this account' });
    }

    // 6. Clé expirée ?
    if (keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
        mcpLogger.warn({ ip: req.ip, userId: keyData.fk_id_user, reason: 'api_key_expired' }, 'MCP request rejected');
        return res.status(401).json({ error: 'API key expired' });
    }

    // 7. Mise à jour last_used_at
    await models.Mcp_keys.update(
        {
            last_used_at: new Date(),
        },
        {
            where: {
                id: keyData.id,
            },
        }
    );

    // 8. Récupérer le rôle de l'utilisateur (nécessaire pour les services de contrôle d'accès)
    const user = await models.User.findByPk(keyData.fk_id_user, {
        attributes: ['role'],
        raw: true,
    });

    // 9. Disponible pour le router et les outils
    req.mcpUser = {
        userId: keyData.fk_id_user,
        scope: keyData.scope,
        userRole: user?.role ?? 'viewer',
    };

    next();
};

export { mcpAuth };
