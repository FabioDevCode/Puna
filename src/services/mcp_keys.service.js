import crypto from 'node:crypto';
import models from '../models/index.js';

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

export async function createMcpKey(userId, { name, expires_at }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
        throw Object.assign(new Error('Invalid name'), { status: 400 });
    }

    let normalizedExpiry = null;
    if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
        const expiryDate = new Date(expires_at);
        expiryDate.setHours(23, 59, 59, 999);
        if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
            throw Object.assign(new Error('expires_at must be a future date'), { status: 400 });
        }
        normalizedExpiry = expiryDate;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const key_hash = hashToken(token);

    const record = await models.Mcp_keys.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        key_hash,
        is_active: true,
        expires_at: normalizedExpiry,
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
