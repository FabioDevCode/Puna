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
import checkUserStatus from '../middlewares/checkUserStatus.js';
import { loginRateLimiter, firstLoginRateLimiter } from '../middlewares/loginRateLimiter.js';

const router = express.Router();

router.get('/error', dashboardCtl.error);
router.get('/', isConnected, checkUserStatus, dashboardCtl.rootRedirect);

router.get('/dp-login', isConnectDash, dashboardCtl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dashboardCtl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', firstLoginRateLimiter, authCtl.dpFirstCoPost);
router.post('/dp-connect', loginRateLimiter, authCtl.dpConnect);

// CONNECTED ========================================================================
router.get('/dashboard', isConnected, checkUserStatus, dashboardCtl.dashboard);

router.get('/stats/inbox-counts', isConnected, checkUserStatus, dashboardCtl.getInboxCounts);
router.get('/stats/inbox-percentages', isConnected, checkUserStatus, dashboardCtl.getInboxPercentages);
router.get('/stats/inbox-heatmap', isConnected, checkUserStatus, dashboardCtl.getInboxHeatmap);
router.get('/stats/top-froms', isConnected, checkUserStatus, dashboardCtl.getTopFroms);
router.get('/stats/top-site-forms', isConnected, checkUserStatus, dashboardCtl.getTopSiteForms);
router.get('/stats/inbox-by-site', isConnected, checkUserStatus, dashboardCtl.getInboxCountsBySite);

// Administration
router.get('/admin', isConnected, checkUserStatus, roleAccess(['super_admin', 'owner']), adminCtl.admin);
router.get('/admin/users', isConnected, checkUserStatus, roleAccess(['super_admin', 'owner']), adminCtl.adminUsers);
router.get(
    '/admin/users/list',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUsersList
);
router.get(
    '/admin/users/export-excel',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUsersExportExcel
);
router.get(
    '/admin/users/export-csv',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUsersExportCSV
);
router.post(
    '/admin/users/create',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminCreateUser
);
router.post(
    '/admin/users/delete',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminDeleteUser
);
router.get(
    '/admin/users/:id/view',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminViewUser
);
router.get(
    '/admin/users/:id/edit',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminEditUser
);
router.post(
    '/admin/users/:id/update',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminUpdateUser
);
router.post(
    '/admin/users/:id/status',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner']),
    adminCtl.adminChangeUserStatus
);
// router.get('/admin/settings', isConnected, roleAccess(['super_admin']), adminCtl.adminSettings);

// Logs Viewer (super_admin uniquement)
router.get('/admin/logs', isConnected, checkUserStatus, roleAccess(['super_admin']), adminCtl.logsViewer);
router.get('/admin/logs/read', isConnected, checkUserStatus, roleAccess(['super_admin']), adminCtl.readLogs);
router.get('/admin/logs/archives', isConnected, checkUserStatus, roleAccess(['super_admin']), adminCtl.getArchives);

// Site
router.get('/site/all', isConnected, checkUserStatus, actionAccess('site', 'read'), dashboardCtl.allSite);
router.get('/site/:id/view', isConnected, checkUserStatus, actionAccess('site', 'read'), siteCtl.showSite);
router.get(
    '/site/:id/token',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner', 'editor', 'beta']),
    actionAccess('site', 'read'),
    siteCtl.getSiteToken
);
router.put(
    '/site/:id/revoke-tokens',
    isConnected,
    checkUserStatus,
    roleAccess(['super_admin', 'owner', 'beta']),
    actionAccess('site', 'update'),
    siteCtl.revokeSiteTokens
);
router.post('/create-site', isConnected, checkUserStatus, actionAccess('site', 'create'), siteCtl.createSite);
router.post('/delete-site/:id', isConnected, checkUserStatus, actionAccess('site', 'delete'), siteCtl.deleteSite);

// Site
router.post('/create-form', isConnected, checkUserStatus, actionAccess('form', 'create'), formCtl.createForm);
router.post('/delete-form', isConnected, checkUserStatus, actionAccess('form', 'delete'), formCtl.deleteForm);
router.get('/form/:id/inbox', isConnected, checkUserStatus, actionAccess('form', 'read'), formCtl.getFormInbox);
router.post(
    '/form/:id/columns',
    isConnected,
    checkUserStatus,
    actionAccess('form', 'update'),
    formCtl.updateFormColumns
);
router.post(
    '/form/:id/template',
    isConnected,
    checkUserStatus,
    actionAccess('form', 'update'),
    formCtl.updateFormTemplateSave
);
router.get(
    '/form/:id/export-excel',
    isConnected,
    checkUserStatus,
    actionAccess('form', 'read'),
    exportCtl.exportFormToExcel
);
router.get(
    '/form/:id/export-csv',
    isConnected,
    checkUserStatus,
    actionAccess('form', 'read'),
    exportCtl.exportFormToCSV
);

// Inbox
router.get('/inbox/:id/view', isConnected, checkUserStatus, actionAccess('inbox', 'read'), inboxCtl.showInbox);
router.post('/inbox/:id/delete', isConnected, checkUserStatus, actionAccess('inbox', 'delete'), inboxCtl.deleteInbox);
router.get(
    '/inbox/:inboxId/download/:filename',
    isConnected,
    checkUserStatus,
    actionAccess('inbox', 'read'),
    inboxCtl.downloadFile
);
router.get(
    '/inbox/:inboxId/download-zip',
    isConnected,
    checkUserStatus,
    actionAccess('inbox', 'read'),
    exportCtl.downloadInboxZip
);

export default router;
