import express from 'express';
import * as siteCtl from '../controllers/site.controller.js';
import { requireAuth } from '../helpers/auth.helpers.js';
import { actionAccess, roleAccess } from '../middlewares/checkAccess.js';

const router = express.Router();

// Prefix - /site
router.get('/all', requireAuth, actionAccess('site', 'read'), siteCtl.allSite);
router.get('/:id/view', requireAuth, actionAccess('site', 'read'), siteCtl.showSite);
router.get('/:id/token', requireAuth, roleAccess(['super_admin', 'owner', 'editor', 'beta']), actionAccess('site', 'read'), siteCtl.getSiteToken);
router.put('/:id/revoke-tokens', requireAuth, roleAccess(['super_admin', 'owner', 'beta']), actionAccess('site', 'update'), siteCtl.revokeSiteTokens);
router.post('/create', requireAuth, actionAccess('site', 'create'), siteCtl.createSite);
router.post('/:id/delete', requireAuth, actionAccess('site', 'delete'), siteCtl.deleteSite);

export default router;
