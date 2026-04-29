import express from 'express';
import * as exportCtl from '../controllers/export.controller.js';
import * as inboxCtl from '../controllers/inbox.controller.js';
import { requireAuth } from '../helpers/auth.helpers.js';
import { actionAccess } from '../middlewares/checkAccess.js';

const router = express.Router();

// Prefix - /inbox
router.get('/:id/view', requireAuth, actionAccess('inbox', 'read'), inboxCtl.showInbox);
router.post('/:id/delete', requireAuth, actionAccess('inbox', 'delete'), inboxCtl.deleteInbox);
router.get('/:inboxId/download/:filename', requireAuth, actionAccess('inbox', 'read'), inboxCtl.downloadFile);
router.get('/:inboxId/download-zip', requireAuth, actionAccess('inbox', 'read'), exportCtl.downloadInboxZip);

export default router;
