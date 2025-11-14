import express from 'express';
const router = express.Router();
import * as dctl from "../controllers/default.controller.js";
import * as authCtl from "../controllers/auth.controller.js";
import { isConnected, isConnectDash } from "../helpers/authHelper.js";


router.get('/error', dctl.error);
router.get('/', isConnected, dctl.rootRedirect);

router.get('/dp-login', isConnectDash,  dctl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dctl.dpFirstCo);

router.post('/dp-first-co', authCtl.dpFirstCoPost);
router.post('/dp-connect', authCtl.dpConnect);
router.get('/dp-logout', authCtl.dpLogout);


// CONNECTED ==============================================================
router.get('/dashboard', isConnected, dctl.dashboard);

router.get('/stats/inbox-counts', isConnected, dctl.getInboxCounts);
router.get('/stats/inbox-percentages', isConnected, dctl.getInboxPercentages);
router.get('/stats/inbox-heatmap', isConnected, dctl.getInboxHeatmap);
router.post('/form/:id/columns', isConnected, dctl.updateFormColumns);
router.get('/stats/inbox-by-site', isConnected, dctl.getInboxCountsBySite);
router.get('/stats/last-inbox', isConnected, dctl.getLastInboxEntry);

router.get('/all-site', isConnected, dctl.allSite)
router.post('/create-site', isConnected, dctl.createSite);
router.get('/site/:id/token', isConnected, dctl.getSiteToken);
router.put('/site/:id/revoke-tokens', isConnected, dctl.revokeSiteTokens);
router.get('/site/:id', isConnected, dctl.showSite);
router.post('/delete-site/:id', isConnected, dctl.deleteSite);

router.post('/create-form', isConnected, dctl.createForm);
router.post('/delete-form', isConnected, dctl.deleteForm);

router.post('/form/:id/template', isConnected, dctl.updateFormTemplateSave);
router.get('/form/:id/inbox', isConnected, dctl.getFormInbox);




export default router;