import express from 'express';
import * as mcpKeysCtl from '../controllers/mcp_keys.controller.js';
import { requireAuth } from '../helpers/auth.helpers.js';

const router = express.Router();

router.get('/', requireAuth, mcpKeysCtl.list);
router.post('/', requireAuth, mcpKeysCtl.create);
router.delete('/:id', requireAuth, mcpKeysCtl.remove);

export default router;
