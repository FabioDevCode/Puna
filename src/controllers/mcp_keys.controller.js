import * as mcpKeysService from '../services/mcp_keys.service.js';

export const list = async (req, res) => {
    try {
        const keys = await mcpKeysService.listMcpKeys(req.session.user.id);
        return res.json({ keys });
    } catch (_err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const create = async (req, res) => {
    const { name, scope, expires_at } = req.body;
    try {
        const result = await mcpKeysService.createMcpKey(req.session.user.id, { name, scope, expires_at });
        return res.status(201).json(result);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
};

export const remove = async (req, res) => {
    try {
        await mcpKeysService.deleteMcpKey(req.session.user.id, req.params.id);
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
};
