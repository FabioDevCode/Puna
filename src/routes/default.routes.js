import express from 'express';
import * as adminCtl from '../controllers/admin.controller.js';
import * as authCtl from '../controllers/auth.controller.js';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import * as exportCtl from '../controllers/export.controller.js';
import * as formCtl from '../controllers/form.controller.js';
import * as inboxCtl from '../controllers/inbox.controller.js';
import * as siteCtl from '../controllers/site.controller.js';
import { isConnected, isConnectDash } from '../helpers/authHelper.js';

const router = express.Router();

router.get('/error', dashboardCtl.error);
router.get('/', isConnected, dashboardCtl.rootRedirect);

router.get('/dp-login', isConnectDash, dashboardCtl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dashboardCtl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', authCtl.dpFirstCoPost);
router.post('/dp-connect', authCtl.dpConnect);

// CONNECTED ==============================================================
router.get('/dashboard', isConnected, dashboardCtl.dashboard);

router.get('/stats/inbox-counts', isConnected, dashboardCtl.getInboxCounts);
router.get('/stats/inbox-percentages', isConnected, dashboardCtl.getInboxPercentages);
router.get('/stats/inbox-heatmap', isConnected, dashboardCtl.getInboxHeatmap);
router.get('/stats/top-froms', isConnected, dashboardCtl.getTopFroms);
router.get('/stats/top-site-forms', isConnected, dashboardCtl.getTopSiteForms);
router.get('/stats/inbox-by-site', isConnected, dashboardCtl.getInboxCountsBySite);
router.get('/stats/last-inbox', isConnected, dashboardCtl.getLastInboxEntry);

// Administration
router.get('/admin', isConnected, adminCtl.admin);
router.get('/admin/users', isConnected, adminCtl.adminUsers);
router.get('/admin/users/list', isConnected, adminCtl.adminUsersList);
router.get('/admin/users/export-excel', isConnected, adminCtl.adminUsersExportExcel);
router.post('/admin/users/create', isConnected, adminCtl.adminCreateUser);
router.post('/admin/users/delete', isConnected, adminCtl.adminDeleteUser);
router.get('/admin/users/:id/view', isConnected, adminCtl.adminViewUser);
router.get('/admin/users/:id/edit', isConnected, adminCtl.adminEditUser);
router.post('/admin/users/:id/update', isConnected, adminCtl.adminUpdateUser);
router.get('/admin/settings', isConnected, adminCtl.adminSettings);

router.get('/site/all', isConnected, dashboardCtl.allSite);
router.get('/site/:id/token', isConnected, siteCtl.getSiteToken);
router.get('/site/:id/view', isConnected, siteCtl.showSite);
router.put('/site/:id/revoke-tokens', isConnected, siteCtl.revokeSiteTokens);
router.post('/create-site', isConnected, siteCtl.createSite);
router.post('/delete-site/:id', isConnected, siteCtl.deleteSite);

router.post('/create-form', isConnected, formCtl.createForm);
router.post('/delete-form', isConnected, formCtl.deleteForm);

router.get('/form/:id/inbox', isConnected, formCtl.getFormInbox);
router.post('/form/:id/columns', isConnected, formCtl.updateFormColumns);
router.post('/form/:id/template', isConnected, formCtl.updateFormTemplateSave);
router.get('/form/:id/export-excel', isConnected, exportCtl.exportFormToExcel);

router.get('/inbox/:id/view', isConnected, inboxCtl.showInbox);
router.post('/inbox/:id/delete', isConnected, inboxCtl.deleteInbox);
router.get('/inbox/:inboxId/download/:filename', isConnected, inboxCtl.downloadFile);
router.get('/inbox/:inboxId/download-zip', isConnected, exportCtl.downloadInboxZip);

export default router;
