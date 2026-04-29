import express from 'express';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import { requireAuth } from '../helpers/auth.helpers.js';

const router = express.Router();

// Prefix - /stats
router.get('/inbox-counts', requireAuth, dashboardCtl.getInboxCounts);
router.get('/inbox-heatmap', requireAuth, dashboardCtl.getInboxHeatmap);
router.get('/top-froms', requireAuth, dashboardCtl.getTopFroms);
router.get('/inbox-by-site', requireAuth, dashboardCtl.getInboxCountsBySite);

export default router;
