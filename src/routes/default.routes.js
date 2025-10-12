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


router.get('/dashboard', isConnected, dctl.dashboard);
router.post('/create-site', isConnected, dctl.createSite);

// Show inbox
// Update inbox
// Delte inbox



export default router;