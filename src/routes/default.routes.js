import express from 'express';
import * as authCtl from '../controllers/auth.controller.js';
import * as dctl from '../controllers/default.controller.js';
import { isConnected, isConnectDash } from '../helpers/authHelper.js';

const router = express.Router();


router.get('/error', dctl.error);
router.get('/', isConnected, dctl.rootRedirect);

router.get('/dp-login', isConnectDash, dctl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dctl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', authCtl.dpFirstCoPost);
router.post('/dp-connect', authCtl.dpConnect);


// CONNECTED ==============================================================
router.get('/dashboard', isConnected, dctl.dashboard);

router.get('/stats/inbox-counts', isConnected, dctl.getInboxCounts);
router.get('/stats/inbox-percentages', isConnected, dctl.getInboxPercentages);
router.get('/stats/inbox-heatmap', isConnected, dctl.getInboxHeatmap);
router.get('/stats/top-froms', isConnected, dctl.getTopFroms);
router.get('/stats/top-site-forms', isConnected, dctl.getTopSiteForms);
router.get('/stats/inbox-by-site', isConnected, dctl.getInboxCountsBySite);
router.get('/stats/last-inbox', isConnected, dctl.getLastInboxEntry);

router.get('/all-site', isConnected, dctl.allSite);
router.get('/site/:id/token', isConnected, dctl.getSiteToken);
router.get('/site/:id', isConnected, dctl.showSite);
router.put('/site/:id/revoke-tokens', isConnected, dctl.revokeSiteTokens);
router.post('/create-site', isConnected, dctl.createSite);
router.post('/delete-site/:id', isConnected, dctl.deleteSite);

router.post('/create-form', isConnected, dctl.createForm);
router.post('/delete-form', isConnected, dctl.deleteForm);

router.get('/form/:id/inbox', isConnected, dctl.getFormInbox);
router.post('/form/:id/columns', isConnected, dctl.updateFormColumns);
router.post('/form/:id/template', isConnected, dctl.updateFormTemplateSave);

router.get('/inbox/:id', isConnected, dctl.showInbox);
router.post('/inbox/:id/delete', isConnected, dctl.deleteInbox);
router.get('/inbox/:inboxId/download/:filename', isConnected, dctl.downloadFile);


export default router;
