import { TOTP, Secret } from 'otpauth';
import { auditLogger, errorLogger } from '../config/logger.js';
import models from '../models/index.js';
import { verifyPassword } from '../services/auth.service.js';
import { disableTotpForUser, enableTotpForUser, generateBackupCodes, generateTotpSetup, getTotpStatus, regenerateBackupCodes } from '../services/twoFactor.service.js';

/**
 * GET /dp-2fa-setup — Génère le QR code et affiche la page d'enrôlement 2FA
 * Accessible uniquement si la 2FA n'est pas déjà activée pour cet utilisateur
 */
export const dp2faSetupGet = async (req, res) => {
    const user = req.session.user;

    try {
        // Vérifier si la 2FA n'est pas déjà activée
        const status = await getTotpStatus(user.id);
        if (status.enabled) {
            res.flash('info', 'La 2FA est déjà activée sur votre compte.');
            return res.redirect('/dashboard');
        }

        const { secret, qrCodeDataUrl } = await generateTotpSetup(user.login);

        // Stocker le secret en session temporaire (pas encore en base)
        req.session.totp_temp_secret = secret;

        auditLogger.info({
            action: '2FA_SETUP_INITIATED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.render('auth/two-factor-setup', {
            layout: 'auth',
            qrCodeDataUrl,
            manualKey: secret, // Clé en base32 pour saisie manuelle
        });
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA setup error');
        res.flash('error', 'Erreur lors de la génération du QR code.');
        return res.redirect('/dashboard');
    }
};

/**
 * POST /dp-2fa-setup — Vérifie le premier code TOTP saisi par l'utilisateur
 * Si OK : persiste le secret en base, génère les codes de récupération, redirige vers l'affichage des codes
 */
export const dp2faSetupPost = async (req, res) => {
    const { totp_code } = req.body;
    const user = req.session.user;
    const tempSecret = req.session.totp_temp_secret;

    if (!tempSecret) {
        res.flash('error', 'Session expirée. Veuillez recommencer la configuration.');
        return res.redirect('/dp-2fa-setup');
    }

    try {
        // Vérifier le code sans chiffrement (le secret est encore en clair en session)
        const totp = new TOTP({
            issuer: process.env.TOTP_ISSUER || 'Puna',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: Secret.fromBase32(tempSecret),
        });

        if (totp.validate({ token: totp_code, window: 1 }) === null) {
            res.flash('error', 'Code invalide. Scannez le QR code et réessayez.');
            return res.redirect('/dp-2fa-setup');
        }

        // Code valide — activer la 2FA
        const { plainCodes, hashedCodes } = await generateBackupCodes();
        await enableTotpForUser(user.id, tempSecret, hashedCodes);

        // Nettoyer la session temporaire
        delete req.session.totp_temp_secret;

        // Stocker les codes en clair en session pour un affichage unique
        req.session.totp_backup_codes_plain = plainCodes;

        auditLogger.info({
            action: '2FA_ENABLED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', 'Authentification à deux facteurs activée !');
        return res.redirect('/dp-2fa-backup-codes');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA enable error');
        res.flash('error', "Erreur lors de l'activation de la 2FA.");
        return res.redirect('/dp-2fa-setup');
    }
};

/**
 * GET /dp-2fa-backup-codes — Affiche les codes de récupération (une seule fois)
 * Les codes sont en session après l'activation ou la régénération, et supprimés après affichage.
 */
export const dp2faBackupCodesGet = (req, res) => {
    const codes = req.session.totp_backup_codes_plain;

    if (!codes || codes.length === 0) {
        res.flash('error', "Aucun code de récupération à afficher. Ils ne sont affichés qu'une seule fois.");
        return res.redirect('/dashboard');
    }

    // Supprimer les codes de la session après affichage
    // On les garde pour le rendu mais on les supprime au prochain request
    res.render('auth/two-factor-backup-codes', {
        layout: 'auth',
        backupCodes: codes,
    });

    // Supprimer après le rendu (pour le prochain accès)
    delete req.session.totp_backup_codes_plain;
};

/**
 * POST /dp-2fa-disable — Désactive la 2FA (requiert le mot de passe actuel)
 */
export const dp2faDisablePost = async (req, res) => {
    const { password } = req.body;
    const user = req.session.user;

    try {
        // Vérifier le mot de passe actuel
        const dbUser = await models.User.findByPk(user.id);
        if (!dbUser) {
            res.flash('error', 'Utilisateur introuvable.');
            return res.redirect('/dashboard');
        }

        const isPasswordValid = await verifyPassword(password, dbUser.password);
        if (!isPasswordValid) {
            res.flash('error', 'Mot de passe incorrect.');
            return res.redirect('/dashboard');
        }

        await disableTotpForUser(user.id);

        auditLogger.info({
            action: '2FA_DISABLED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', 'Authentification à deux facteurs désactivée.');
        return res.redirect('/dashboard');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA disable error');
        res.flash('error', 'Erreur lors de la désactivation de la 2FA.');
        return res.redirect('/dashboard');
    }
};

/**
 * POST /dp-2fa-regenerate — Régénère les codes de récupération (requiert le mot de passe)
 */
export const dp2faRegeneratePost = async (req, res) => {
    const { password } = req.body;
    const user = req.session.user;

    try {
        const dbUser = await models.User.findByPk(user.id);
        if (!dbUser) {
            res.flash('error', 'Utilisateur introuvable.');
            return res.redirect('/dashboard');
        }

        const isPasswordValid = await verifyPassword(password, dbUser.password);
        if (!isPasswordValid) {
            res.flash('error', 'Mot de passe incorrect.');
            return res.redirect('/dashboard');
        }

        const { plainCodes } = await regenerateBackupCodes(user.id);

        // Stocker pour affichage unique
        req.session.totp_backup_codes_plain = plainCodes;

        auditLogger.info({
            action: '2FA_BACKUP_CODES_REGENERATED',
            userId: user.id,
            login: user.login,
            ip: req.ip,
        });

        res.flash('success', 'Codes de récupération régénérés.');
        return res.redirect('/dp-2fa-backup-codes');
    } catch (err) {
        errorLogger.error({ err, userId: user.id }, '2FA regenerate error');
        res.flash('error', 'Erreur lors de la régénération des codes.');
        return res.redirect('/dashboard');
    }
};

/**
 * POST /dp-dismiss-2fa-banner — Rejette la bannière de suggestion 2FA
 */
export const dismiss2FABanner = (req, res) => {
    req.session.dismissed2FABanner = true;
    return res.redirect('/dashboard');
};
