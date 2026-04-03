import express from 'express';
import * as adminCtl from '../controllers/admin/index.js';
import * as authCtl from '../controllers/auth.controller.js';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import * as exportCtl from '../controllers/export.controller.js';
import * as formCtl from '../controllers/form.controller.js';
import * as inboxCtl from '../controllers/inbox.controller.js';
import * as passwordResetCtl from '../controllers/passwordReset.controller.js';
import * as profileCtl from '../controllers/profile.controller.js';
import * as siteCtl from '../controllers/site.controller.js';
import * as twoFactorCtl from '../controllers/twoFactor.controller.js';
import { requireAuth, isConnectDash, requirePending2FA } from '../helpers/authHelper.js';
import { actionAccess, roleAccess } from '../middlewares/checkAccess.js';
import {
    loginRateLimiter,
    firstLoginRateLimiter,
    forgotPasswordRateLimiter,
    resetPasswordRateLimiter,
    twoFaRateLimiter,
    twoFaConfigRateLimiter,
} from '../middlewares/loginRateLimiter.js';

const router = express.Router();

router.get('/error', dashboardCtl.error);
router.get('/', requireAuth, dashboardCtl.rootRedirect);

router.get('/dp-login', isConnectDash, dashboardCtl.dpLogin);
router.get('/dp-first-connexion', isConnectDash, dashboardCtl.dpFirstCo);

router.get('/dp-logout', authCtl.dpLogout);
router.post('/dp-first-co', firstLoginRateLimiter, authCtl.dpFirstCoPost);
router.post('/dp-connect', loginRateLimiter, authCtl.dpConnect);

// Password Reset
router.get('/dp-forgot-password', isConnectDash, passwordResetCtl.forgotPasswordGet);
router.post('/dp-forgot-password', forgotPasswordRateLimiter, passwordResetCtl.forgotPasswordPost);
router.get('/dp-reset-password/:token', isConnectDash, passwordResetCtl.resetPasswordGet);
router.post('/dp-reset-password/:token', resetPasswordRateLimiter, passwordResetCtl.resetPasswordPost);

// 2FA Verification (session intermédiaire — mot de passe validé, TOTP en attente)
router.get('/dp-2fa-verify', requirePending2FA, twoFactorCtl.dp2faVerifyGet);
router.post('/dp-2fa-verify', twoFaRateLimiter, requirePending2FA, twoFactorCtl.dp2faVerifyPost);
router.get('/dp-2fa-recovery', requirePending2FA, twoFactorCtl.dp2faRecoveryGet);
router.post('/dp-2fa-recovery', twoFaRateLimiter, requirePending2FA, twoFactorCtl.dp2faRecoveryPost);

// CONNECTED ========================================================================

// 2FA Configuration (utilisateur connecté)
router.get('/dp-2fa-setup', requireAuth, twoFactorCtl.dp2faSetupGet);
router.post('/dp-2fa-setup', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faSetupPost);
router.get('/dp-2fa-backup-codes', requireAuth, twoFactorCtl.dp2faBackupCodesGet);
router.post('/dp-2fa-disable', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faDisablePost);
router.post('/dp-2fa-regenerate', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faRegeneratePost);

router.get('/dashboard', requireAuth, dashboardCtl.dashboard);

router.get('/profile', requireAuth, profileCtl.profilePage);
router.post('/profile/locale', requireAuth, profileCtl.updateLocale);

router.get('/stats/inbox-counts', requireAuth, dashboardCtl.getInboxCounts);
router.get('/stats/inbox-heatmap', requireAuth, dashboardCtl.getInboxHeatmap);
router.get('/stats/top-froms', requireAuth, dashboardCtl.getTopFroms);
router.get('/stats/inbox-by-site', requireAuth, dashboardCtl.getInboxCountsBySite);

// Administration
router.get('/admin', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.admin);
router.get('/admin/users', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsers);
router.get('/admin/users/list', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersList);
router.get('/admin/users/export-excel', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersExportExcel);
router.get('/admin/users/export-csv', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUsersExportCSV);
router.post('/admin/users/create', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminCreateUser);
router.post('/admin/users/delete', requireAuth, roleAccess(['super_admin']), adminCtl.adminDeleteUser);
router.get('/admin/users/:id/view', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminViewUser);
router.get('/admin/users/:id/edit', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminEditUser);
router.post('/admin/users/:id/update', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminUpdateUser);
router.post('/admin/users/:id/status', requireAuth, roleAccess(['super_admin', 'owner']), adminCtl.adminChangeUserStatus);
// router.get('/admin/settings', isConnected, roleAccess(['super_admin']), adminCtl.adminSettings);

// Logs Viewer (super_admin uniquement)
router.get('/admin/logs', requireAuth, roleAccess(['super_admin']), adminCtl.logsViewer);
router.get('/admin/logs/read', requireAuth, roleAccess(['super_admin']), adminCtl.readLogs);
router.get('/admin/logs/archives', requireAuth, roleAccess(['super_admin']), adminCtl.getArchives);

// Site
router.get('/site/all', requireAuth, actionAccess('site', 'read'), siteCtl.allSite);
router.get('/site/:id/view', requireAuth, actionAccess('site', 'read'), siteCtl.showSite);
router.get('/site/:id/token', requireAuth, roleAccess(['super_admin', 'owner', 'editor', 'beta']), actionAccess('site', 'read'), siteCtl.getSiteToken);
router.put('/site/:id/revoke-tokens', requireAuth, roleAccess(['super_admin', 'owner', 'beta']), actionAccess('site', 'update'), siteCtl.revokeSiteTokens);
router.post('/create-site', requireAuth, actionAccess('site', 'create'), siteCtl.createSite);
router.post('/delete-site/:id', requireAuth, actionAccess('site', 'delete'), siteCtl.deleteSite);

// Site
router.post('/create-form', requireAuth, actionAccess('form', 'create'), formCtl.createForm);
router.post('/delete-form', requireAuth, actionAccess('form', 'delete'), formCtl.deleteForm);
router.get('/form/:id/inbox', requireAuth, actionAccess('form', 'read'), formCtl.getFormInbox);
router.post('/form/:id/columns', requireAuth, actionAccess('form', 'update'), formCtl.updateFormColumns);
router.post('/form/:id/template', requireAuth, actionAccess('form', 'update'), formCtl.updateFormTemplateSave);
router.get('/form/:id/export-excel', requireAuth, actionAccess('form', 'read'), exportCtl.exportFormToExcel);
router.get('/form/:id/export-csv', requireAuth, actionAccess('form', 'read'), exportCtl.exportFormToCSV);

// Inbox
router.get('/inbox/:id/view', requireAuth, actionAccess('inbox', 'read'), inboxCtl.showInbox);
router.post('/inbox/:id/delete', requireAuth, actionAccess('inbox', 'delete'), inboxCtl.deleteInbox);
router.get('/inbox/:inboxId/download/:filename', requireAuth, actionAccess('inbox', 'read'), inboxCtl.downloadFile);
router.get('/inbox/:inboxId/download-zip', requireAuth, actionAccess('inbox', 'read'), exportCtl.downloadInboxZip);

export default router;
