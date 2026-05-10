import crypto from 'node:crypto';
import models from '../models/index.js';

const VALID_SCOPES = ['read', 'read_write', 'read_write_access'];

function hashToken(token) {
    return crypto.createHmac('sha256', process.env.MCP_HASH_SECRET).update(token).digest('hex');
}

export async function listMcpKeys(userId) {
    return models.Mcp_keys.findAll({
        where: { fk_id_user: userId },
        attributes: ['id', 'name', 'scope', 'is_active', 'last_used_at', 'expires_at', 'createdAt'],
        order: [['createdAt', 'DESC']],
    });
}

export async function createMcpKey(userId, { name, scope, expires_at }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
        throw Object.assign(new Error('Invalid name'), { status: 400 });
    }
    if (!VALID_SCOPES.includes(scope)) {
        throw Object.assign(new Error('Invalid scope'), { status: 400 });
    }
    if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
        const expiryDate = new Date(expires_at);
        if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
            throw Object.assign(new Error('expires_at must be a future date'), { status: 400 });
        }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const key_hash = hashToken(token);

    const record = await models.Mcp_keys.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        scope,
        key_hash,
        is_active: true,
        expires_at: expires_at || null,
        fk_id_user: userId,
    });

    return {
        token,
        key: {
            id: record.id,
            name: record.name,
            scope: record.scope,
            is_active: record.is_active,
            last_used_at: record.last_used_at,
            expires_at: record.expires_at,
            createdAt: record.createdAt,
        },
    };
}

export async function deleteMcpKey(userId, keyId) {
    const key = await models.Mcp_keys.findOne({
        where: { id: keyId, fk_id_user: userId },
    });

    if (!key) {
        throw Object.assign(new Error('Not found'), { status: 404 });
    }

    await key.destroy();
}
