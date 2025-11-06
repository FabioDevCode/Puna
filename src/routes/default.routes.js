import express from 'express';
const router = express.Router();
import * as dctl from "../controllers/default.controller.js";
import * as authCtl from "../controllers/auth.controller.js";
import { isConnected } from "../helpers/authHelper.js";


router.get('/error', dctl.error);
router.get('/dp-login',  dctl.dpLogin);
router.get('/dp-first-connexion', dctl.dpFirstCo);
router.post('/dp-first-co', authCtl.dpFirstCoPost);
router.post('/dp-connect', authCtl.dpConnect);
router.get('/dp-logout', authCtl.dpLogout);

// CONNECTED ===================================================
router.get('/dashboard', isConnected, dctl.dashboard);

router.get('/all-site', isConnected, dctl.allSite)
router.post('/create-site', isConnected, dctl.createSite);
router.get('/site/:id/token', isConnected, dctl.getSiteToken);
router.get('/site/:id', isConnected, dctl.showSite);
router.post('/delete-site/:id', isConnected, dctl.deleteSite);

router.post('/create-form', isConnected, dctl.createForm);
router.post('/delete-form', isConnected, dctl.deleteForm);

router.post('/form/:id/template', isConnected, dctl.updateFormTemplateSave);

// Fetch inbox items for a form (used by client-side to display data)
router.get('/form/:id/inbox', isConnected, dctl.getFormInbox);




export default router;