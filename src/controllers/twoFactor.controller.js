import { auditLogger, errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import { verifyTotpToken, verifyBackupCode } from '../services/twoFactor.service.js';

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
            res.flash('error', 'Erreur de configuration 2FA.');
            return res.redirect('/dp-login');
        }

        if (!totp_code || typeof totp_code !== 'string' || !/^\d{6}$/.test(totp_code)) {
            res.flash('error', 'Code invalide. Veuillez réessayer.');
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
            res.flash('error', 'Code invalide. Veuillez réessayer.');
            return res.redirect('/dp-2fa-verify');
        }

        // 2FA validée — finaliser la session
        req.session.user = {
            id: pending.userId,
            login: pending.login,
            email: pending.email,
            role: pending.role,
            status: pending.status,
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
        res.flash('error', 'Erreur lors de la vérification.');
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
            res.flash('error', 'Erreur de configuration 2FA.');
            return res.redirect('/dp-login');
        }

        if (!recovery_code || typeof recovery_code !== 'string' || recovery_code.trim() === '') {
            res.flash('error', 'Code de récupération invalide.');
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
            res.flash('error', 'Code de récupération invalide.');
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
            res.flash('warning', 'Dernier code de récupération utilisé ! Régénérez vos codes dans les paramètres.');
        } else {
            res.flash('success', `Connexion réussie. Il vous reste ${result.remainingCount} code(s) de récupération.`);
        }

        return res.redirect('/dashboard');
    } catch (err) {
        errorLogger.error({ err, userId: pending.userId }, '2FA recovery error');
        res.flash('error', 'Erreur lors de la vérification.');
        return res.redirect('/dp-2fa-recovery');
    }
};
