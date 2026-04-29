import express from 'express';
import * as authCtl from '../controllers/auth.controller.js';
import * as dashboardCtl from '../controllers/dashboard.controller.js';
import * as passwordResetCtl from '../controllers/passwordReset.controller.js';
import * as profileCtl from '../controllers/profile.controller.js';
import * as twoFactorCtl from '../controllers/twoFactor.controller.js';
import { requireAuth, isConnectDash, requirePending2FA } from '../helpers/auth.helpers.js';
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

// 2FA Configuration (utilisateur connecté)
router.get('/dp-2fa-setup', requireAuth, twoFactorCtl.dp2faSetupGet);
router.post('/dp-2fa-setup', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faSetupPost);
router.get('/dp-2fa-backup-codes', requireAuth, twoFactorCtl.dp2faBackupCodesGet);
router.post('/dp-2fa-disable', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faDisablePost);
router.post('/dp-2fa-regenerate', requireAuth, twoFaConfigRateLimiter, twoFactorCtl.dp2faRegeneratePost);

router.get('/dashboard', requireAuth, dashboardCtl.dashboard);

router.get('/profile', requireAuth, profileCtl.profilePage);
router.post('/profile/locale', requireAuth, profileCtl.updateLocale);

export default router;
