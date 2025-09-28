import express from 'express';
const router = express.Router();
import * as dctl from "../controllers/default.controller.js";

router.get('/error', dctl.error);
router.get('/dp-login',  dctl.dpLogin);
router.get('/dp-first-connexion', dctl.dpFirstCo);
router.post('/dp-first-co', dctl.dpFirstCoPost);
router.post('/dp-connect', dctl.dpConnect);
router.get('/dashboard', dctl.dashboard)


export default router;