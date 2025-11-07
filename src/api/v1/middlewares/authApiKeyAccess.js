import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import models from '../../../models/index.js';
import { decryptObject } from '../../../utils/crypto.js';

export async function authApiKeyAccess(req, res, next) {
	try {
		// 1) Check X-KEY-PUNA header
		const apiKey = req.headers['x-key-puna'];
		if (!apiKey || apiKey !== 'puna') {
			return res.status(401).json({ error: 'Invalid API key' });
		}

		// 2) Check Authorization Bearer token
		const auth = req.headers['authorization'] || req.headers['Authorization'];
		if (!auth || !auth.startsWith('Bearer ')) {
			return res.status(401).json({ error: 'Missing Bearer token' });
		}

		const token = auth.slice(7).trim();

		// load secret
		let secret = process.env.KEY_TK;
		if (!secret) {
			const keysPath = path.resolve('src/config/keys.json');
			if (fs.existsSync(keysPath)) {
				const raw = fs.readFileSync(keysPath, 'utf8');
				const cfg = JSON.parse(raw);
				secret = cfg.KEY_TK;
			}
		}
		if (!secret) return res.status(500).json({ error: 'Server key not configured' });

		let payload;
		try {
			payload = decryptObject(jwt.verify(token, secret).data);
		} catch (err) {
			return res.status(401).json({ error: 'Invalid token' });
		}

		const siteId = payload.id;
		const controlCode = payload.control_code;
		if (!siteId || !controlCode) return res.status(401).json({ error: 'Invalid token' });

		const site = await models.Site.findOne({ where: { id: siteId, control_code: controlCode }, raw: true });
		if (!site) return res.status(403).json({ error: 'Site not found' });

		// 3) Verify params.code corresponds to a Form with same fk_id_site
		const formCode = req.params.code;
		if (!formCode) return res.status(400).json({ error: 'Missing form code' });

		const form = await models.Form.findOne({ where: { code: formCode, fk_id_site: siteId }, raw: true });
		if (!form) return res.status(404).json({ error: 'Form not found' });

		req.site = site;
		req.form = form;

		return next();
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
}

