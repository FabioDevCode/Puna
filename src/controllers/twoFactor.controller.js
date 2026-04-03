import { auditLogger, errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import { verifyPassword } from '../services/auth.service.js';
import {
    generateTotpSetup,
    verifyTotpToken,
    generateBackupCodes,
    enableTotpForUser,
    disableTotpForUser,
    regenerateBackupCodes,
    getTotpStatus,
    verifyBackupCode,
} from '../services/twoFactor.service.js';

/**
 * GET /dp-2fa-verify — Affiche le formulaire de saisie du code TOTP
 * Accessible uniquement si req.session.pending2FA est défini (guard requirePending2FA)
 */
export const dp2faVerifyGet = (req, res) => {
    res.render('auth/two-factor-verify', { layout: 'auth' });
};

/**
 * POST /dp-2fa-verify — Vérifie le code TOTP et finalise la connexion
 */
export const dp2faVerifyPost = async (req, res) => {
    const { totp_code } = req.body;
    const pending = req.session.pending2FA;

    if (!pending) {
        return res.redirect('/dp-login');
    }

    try {
        const user = await models.User.findByPk(pending.userId);

        if (!user || !user.totp_enabled || !user.totp_secret) {
            res.flash('error', req.__('flash.2fa_config_error'));
            return res.redirect('/dp-login');
        }

        if (!totp_code || typeof totp_code !== 'string' || !/^\d{6}$/.test(totp_code)) {
            res.flash('error', req.__('flash.2fa_invalid_code'));
            return res.redirect('/dp-2fa-verify');
        }

        if (!verifyTotpToken(user.totp_secret, totp_code)) {
            auditLogger.warn({
                action: '2FA_VERIFY_FAILED',
                userId: pending.userId,
                login: pending.login,
                ip: req.ip,
                reason: 'invalid_totp_code',
            });
            res.flash('error', req.__('flash.2fa_invalid_code'));
            return res.redirect('/dp-2fa-verify');
        }

        // 2FA validée — finaliser la session
        req.session.user = {
            id: pending.userId,
            login: pending.login,
            email: pending.email,
            role: pending.role,
            status: pending.status,
            locale: user.locale || 'fr',
        };
        delete req.session.pending2FA;

        auditLogger.info({
            action: 'LOGIN_SUCCESS',
            userId: pending.userId,
            login: pending.login,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            twoFactor: true,
        });

        return res.redirect('/dashboard');
    } catch (err) {
        errorLogger.error({ err, userId: pending.userId }, '2FA verify error');
        res.flash('error', req.__('flash.2fa_verification_error'));
        return res.redirect('/dp-2fa-verify');
    }
};

/**
 * GET /dp-2fa-recovery — Affiche le formulaire de saisie d'un code de récupération
 */
export const dp2faRecoveryGet = (req, res) => {
    res.render('auth/two-factor-recovery', { layout: 'auth' });
};

/**
 * POST /dp-2fa-recovery — Vérifie un code de récupération et finalise la connexion
 */
export const dp2faRecoveryPost = async (req, res) => {
    const { recovery_code } = req.body;
    const pending = req.session.pending2FA;

    if (!pending) {
        return res.redirect('/dp-login');
    }

    try {
        const user = await models.User.findByPk(pending.userId);

        if (!user || !user.totp_enabled || !user.totp_backup_codes) {
            res.flash('error', req.__('flash.2fa_config_error'));
            return res.redirect('/dp-login');
        }

        if (!recovery_code || typeof recovery_code !== 'string' || recovery_code.trim() === '') {
            res.flash('error', req.__('flash.2fa_invalid_recovery'));
            return res.redirect('/dp-2fa-recovery');
        }

        const result = await verifyBackupCode(user.totp_backup_codes, recovery_code);

        if (!result.valid) {
            auditLogger.warn({
                action: '2FA_RECOVERY_FAILED',
                userId: pending.userId,
                login: pending.login,
                ip: req.ip,
            });
            res.flash('error', req.__('flash.2fa_invalid_recovery'));
            return res.redirect('/dp-2fa-recovery');
        }

        // Mettre à jour les codes restants en base
        await models.User.update({ totp_backup_codes: result.updatedEncryptedCodes }, { where: { id: pending.userId } });

        // Finaliser la session
        req.session.user = {
            id: pending.userId,
            login: pending.login,
            email: pending.email,
            role: pending.role,
            status: pending.status,
            locale: user.locale || 'fr',
        };
        delete req.session.pending2FA;

        auditLogger.warn({
            action: '2FA_BACKUP_CODE_USED',
            userId: pending.userId,
            login: pending.login,
            ip: req.ip,
            codesRemaining: result.remainingCount,
        });

        // Avertir l'utilisateur du nombre de codes restants
        if (result.remainingCount === 0) {
            res.flash('warning', req.__('flash.2fa_last_recovery_used'));
        } else {
            res.flash('success', req.__('flash.2fa_login_remaining', { count: result.remainingCount }));
        }

        return res.redirect('/dashboard');
    } catch (err) {
        errorLogger.error({ err, userId: pending.userId }, '2FA recovery error');
        res.flash('error', req.__('flash.2fa_verification_error'));
        return res.redirect('/dp-2fa-recovery');
    }
};

/**
 * GET /dp-2fa-setup — Affiche le formulaire de configuration 2FA
 * Accessible uniquement si l'utilisateur est connecté
 */
export const dp2faSetupGet = async (req, res) => {
    const user = req.session.user;

    try {
        const status = await getTotpStatus(user.id);

        if (status.enabled) {
            res.flash('info', req.__('flash.2fa_already_enabled'));
            return res.redirect('/dashboard');
        }

        const { secret, qrCodeDataUrl } = await generateTotpSetup(user.login);
        req.session.totp_temp_secret = secret;

        auditLogger.info({
            action: '2FA_SETUP_INITIATED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        return res.render('auth/two-factor-setup', { layout: 'auth', qrCodeDataUrl, manualKey: secret });
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA setup GET error');
        res.flash('error', req.__('flash.2fa_config_error'));
        return res.redirect('/dashboard');
    }
};

/**
 * POST /dp-2fa-setup — Vérifie le code TOTP et active la 2FA
 */
export const dp2faSetupPost = async (req, res) => {
    const { totp_code } = req.body;
    const user = req.session.user;
    const tempSecret = req.session.totp_temp_secret;

    if (!tempSecret) {
        res.flash('error', req.__('flash.2fa_session_expired'));
        return res.redirect('/dp-2fa-setup');
    }

    if (!totp_code || typeof totp_code !== 'string' || !/^\d{6}$/.test(totp_code)) {
        res.flash('error', req.__('flash.2fa_invalid_qr_code'));
        return res.redirect('/dp-2fa-setup');
    }

    // Vérification directe avec le secret brut (pas encore chiffré en base)
    // On ne peut pas utiliser verifyTotpToken() car il attend un secret chiffré (AES)
    try {
        const { TOTP, Secret } = await import('otpauth');
        const totp = new TOTP({
            issuer: process.env.TOTP_ISSUER || 'Puna',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: Secret.fromBase32(tempSecret),
        });

        if (totp.validate({ token: totp_code, window: 1 }) === null) {
            res.flash('error', req.__('flash.2fa_invalid_qr_code'));
            return res.redirect('/dp-2fa-setup');
        }
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA TOTP validation error');
        res.flash('error', req.__('flash.2fa_invalid_qr_code'));
        return res.redirect('/dp-2fa-setup');
    }

    try {
        const { plainCodes, hashedCodes } = await generateBackupCodes();
        await enableTotpForUser(user.id, tempSecret, hashedCodes);

        delete req.session.totp_temp_secret;
        req.session.totp_backup_codes_plain = plainCodes;

        auditLogger.info({
            action: '2FA_ENABLED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', req.__('flash.2fa_enabled'));
        return res.redirect('/dp-2fa-backup-codes');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA setup POST error');
        res.flash('error', req.__('flash.2fa_enable_error'));
        return res.redirect('/dp-2fa-setup');
    }
};

/**
 * GET /dp-2fa-backup-codes — Affiche les codes de récupération (une seule fois)
 */
export const dp2faBackupCodesGet = (req, res) => {
    const codes = req.session.totp_backup_codes_plain;

    if (!codes || codes.length === 0) {
        return res.redirect('/dashboard');
    }

    delete req.session.totp_backup_codes_plain;
    return res.render('auth/two-factor-backup-codes', { layout: 'auth', backupCodes: codes });
};

/**
 * POST /dp-2fa-disable — Désactive la 2FA après vérification du mot de passe
 */
export const dp2faDisablePost = async (req, res) => {
    const { password } = req.body;
    const user = req.session.user;

    try {
        const dbUser = await models.User.findByPk(user.id);

        if (!dbUser) {
            res.flash('error', req.__('flash.2fa_config_error'));
            return res.redirect('/dashboard');
        }

        const isValid = await verifyPassword(password, dbUser.password);

        if (!isValid) {
            res.flash('error', req.__('flash.wrong_password'));
            return res.redirect('/dashboard');
        }

        await disableTotpForUser(user.id);

        auditLogger.info({
            action: '2FA_DISABLED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', req.__('flash.2fa_disabled'));
        return res.redirect('/dashboard');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA disable error');
        res.flash('error', req.__('flash.2fa_disable_error'));
        return res.redirect('/dashboard');
    }
};

/**
 * POST /dp-2fa-regenerate — Régénère les codes de récupération après vérification du mot de passe
 */
export const dp2faRegeneratePost = async (req, res) => {
    const { password } = req.body;
    const user = req.session.user;

    try {
        const dbUser = await models.User.findByPk(user.id);

        if (!dbUser) {
            res.flash('error', req.__('flash.2fa_config_error'));
            return res.redirect('/dashboard');
        }

        const isValid = await verifyPassword(password, dbUser.password);

        if (!isValid) {
            res.flash('error', req.__('flash.wrong_password'));
            return res.redirect('/dashboard');
        }

        const { plainCodes } = await regenerateBackupCodes(user.id);
        req.session.totp_backup_codes_plain = plainCodes;

        auditLogger.info({
            action: '2FA_BACKUP_CODES_REGENERATED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', req.__('flash.2fa_codes_regenerated'));
        return res.redirect('/dp-2fa-backup-codes');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA regenerate error');
        res.flash('error', req.__('flash.2fa_codes_regen_error'));
        return res.redirect('/dashboard');
    }
};
