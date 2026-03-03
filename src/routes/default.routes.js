import express from 'express';
import * as adminCtl from '../controllers/admin/index.js';
import * as authCtl from '../controllers/auth.controller.js';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import * as exportCtl from '../controllers/export.controller.js';
import * as formCtl from '../controllers/form.controller.js';
import * as inboxCtl from '../controllers/inbox.controller.js';
import * as siteCtl from '../controllers/site.controller.js';
import { isConnected, isConnectDash } from '../helpers/authHelper.js';
import { actionAccess, roleAccess } from '../middlewares/checkAccess.js';
import { loginRateLimiter, firstLoginRateLimiter } from '../middlewares/loginRateLimiter.js';

const router = express.Router();

router.get('/error', dashboardCtl.error);
router.get('/', isConnected, dashboardCtl.rootRedirect);

router.get('/dp-login', isConnectDash, dashboardCtl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dashboardCtl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', firstLoginRateLimiter, authCtl.dpFirstCoPost);
router.post('/dp-connect', loginRateLimiter, authCtl.dpConnect);

// CONNECTED ========================================================================
router.get('/dashboard', isConnected, dashboardCtl.dashboard);

router.get('/stats/inbox-counts', isConnected, dashboardCtl.getInboxCounts);
router.get('/stats/inbox-percentages', isConnected, dashboardCtl.getInboxPercentages);
router.get('/stats/inbox-heatmap', isConnected, dashboardCtl.getInboxHeatmap);
router.get('/stats/top-froms', isConnected, dashboardCtl.getTopFroms);
router.get('/stats/top-site-forms', isConnected, dashboardCtl.getTopSiteForms);
router.get('/stats/inbox-by-site', isConnected, dashboardCtl.getInboxCountsBySite);

// Administration
router.get('/admin', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.admin);
router.get('/admin/users', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminUsers);
router.get('/admin/users/list', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersList);
router.get(
    '/admin/users/export-excel',
    isConnected,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUsersExportExcel
);
router.get('/admin/users/export-csv', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersExportCSV);
router.post('/admin/users/create', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminCreateUser);
router.post('/admin/users/delete', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminDeleteUser);
router.get('/admin/users/:id/view', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminViewUser);
router.get('/admin/users/:id/edit', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminEditUser);
router.post('/admin/users/:id/update', isConnected, roleAccess(['super_admin', 'owner']), adminCtl.adminUpdateUser);
// router.get('/admin/settings', isConnected, roleAccess(['super_admin']), adminCtl.adminSettings);

// Logs Viewer (super_admin uniquement)
router.get('/admin/logs', isConnected, roleAccess(['super_admin']), adminCtl.logsViewer);
router.get('/admin/logs/read', isConnected, roleAccess(['super_admin']), adminCtl.readLogs);
router.get('/admin/logs/archives', isConnected, roleAccess(['super_admin']), adminCtl.getArchives);

// Site
router.get('/site/all', isConnected, actionAccess('site', 'read'), dashboardCtl.allSite);
router.get('/site/:id/view', isConnected, actionAccess('site', 'read'), siteCtl.showSite);
router.get(
    '/site/:id/token',
    isConnected,
    roleAccess(['super_admin', 'owner', 'editor', 'beta']),
    actionAccess('site', 'read'),
    siteCtl.getSiteToken
);
router.put(
    '/site/:id/revoke-tokens',
    isConnected,
    roleAccess(['super_admin', 'owner', 'beta']),
    actionAccess('site', 'update'),
    siteCtl.revokeSiteTokens
);
router.post('/create-site', isConnected, actionAccess('site', 'create'), siteCtl.createSite);
router.post('/delete-site/:id', isConnected, actionAccess('site', 'delete'), siteCtl.deleteSite);

// Site
router.post('/create-form', isConnected, actionAccess('form', 'create'), formCtl.createForm);
router.post('/delete-form', isConnected, actionAccess('form', 'delete'), formCtl.deleteForm);
router.get('/form/:id/inbox', isConnected, actionAccess('form', 'read'), formCtl.getFormInbox);
router.post('/form/:id/columns', isConnected, actionAccess('form', 'update'), formCtl.updateFormColumns);
router.post('/form/:id/template', isConnected, actionAccess('form', 'update'), formCtl.updateFormTemplateSave);
router.get('/form/:id/export-excel', isConnected, actionAccess('form', 'read'), exportCtl.exportFormToExcel);
router.get('/form/:id/export-csv', isConnected, actionAccess('form', 'read'), exportCtl.exportFormToCSV);

// Inbox
router.get('/inbox/:id/view', isConnected, actionAccess('inbox', 'read'), inboxCtl.showInbox);
router.post('/inbox/:id/delete', isConnected, actionAccess('inbox', 'delete'), inboxCtl.deleteInbox);
router.get('/inbox/:inboxId/download/:filename', isConnected, actionAccess('inbox', 'read'), inboxCtl.downloadFile);
router.get('/inbox/:inboxId/download-zip', isConnected, actionAccess('inbox', 'read'), exportCtl.downloadInboxZip);

export default router;
