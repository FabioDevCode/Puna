/**
 * Service de réinitialisation de mot de passe
 * Gère la génération de tokens, l'envoi d'email, la validation et la mise à jour du mot de passe
 */

import crypto from 'node:crypto';
import { logger as appLogger, auditLogger } from '../config/logger.js';
import { sendMail, mailEnabled } from '../config/mailer.js';
import { renderMailTemplate } from '../helpers/mail.helpers.js';
import models from '../models/index.js';
import { hashPassword } from './auth.service.js';

/**
 * Générer un token de réinitialisation de mot de passe
 * @returns {{ rawToken: string, hashedToken: string, expires: Date }}
 */
export function generateResetToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    return { rawToken, hashedToken, expires };
}

/**
 * Créer une demande de réinitialisation de mot de passe et envoyer l'email
 * Anti-énumération : ne lève pas d'erreur si l'email est introuvable
 * @param {string} email - Adresse email de l'utilisateur
 * @returns {Promise<void>}
 * @throws {Error} Si le service mail n'est pas configuré
 */
export async function createPasswordResetRequest(email) {
    if (!mailEnabled) {
        throw new Error('Mail service is not configured');
    }

    try {
        const user = await models.User.findOne({ where: { email, status: 'active' } });

        if (!user) {
            appLogger.debug({ email }, 'Password reset requested for unknown or inactive email');
            return;
        }

        const { rawToken, hashedToken, expires } = generateResetToken();

        await user.update({
            password_reset_token: hashedToken,
            password_reset_expires: expires,
        });

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/dp-reset-password/${rawToken}`;

        const html = await renderMailTemplate('reset-password', { resetUrl });

        await sendMail({
            to: user.email,
            subject: 'Réinitialisation de votre mot de passe — Puna',
            html,
        });

        auditLogger.info({ action: 'PASSWORD_RESET_REQUESTED', userId: user.id, email: user.email }, 'Password reset email sent');
    } catch (err) {
        appLogger.error({ err, email }, 'Error during password reset request');
    }
}

/**
 * Valider un token de réinitialisation de mot de passe
 * @param {string} rawToken - Token brut reçu dans l'URL
 * @returns {Promise<Object|null>} - Instance Sequelize de l'utilisateur ou null si invalide/expiré
 */
export async function validateResetToken(rawToken) {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await models.User.findOne({
        where: {
            password_reset_token: hashedToken,
            password_reset_expires: { [models.Op.gt]: new Date() },
        },
    });

    return user || null;
}

/**
 * Réinitialiser le mot de passe d'un utilisateur à partir d'un token valide
 * @param {string} rawToken - Token brut reçu dans l'URL
 * @param {string} newPassword - Nouveau mot de passe en clair
 * @returns {Promise<boolean>} - true si la réinitialisation a réussi, false si le token est invalide
 */
export async function resetPassword(rawToken, newPassword) {
    const user = await validateResetToken(rawToken);

    if (!user) {
        return false;
    }

    const hashedPassword = await hashPassword(newPassword);

    await user.update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
    });

    auditLogger.info({ action: 'PASSWORD_RESET_SUCCESS', userId: user.id }, 'Password reset successfully');

    return true;
}
