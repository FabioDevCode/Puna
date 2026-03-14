/**
 * Service de réinitialisation de mot de passe
 * Gère la génération de tokens, l'envoi d'email, la validation et la mise à jour du mot de passe
 */

import crypto from 'node:crypto';
import { logger as appLogger, auditLogger } from '../config/logger.js';
import { sendMail, mailEnabled } from '../config/mailer.js';
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

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1a1a2e;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Puna</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#333333;font-size:16px;">Bonjour,</p>
              <p style="margin:0 0 24px;color:#555555;font-size:15px;line-height:1.6;">
                Vous avez demandé la réinitialisation de votre mot de passe.
                Cliquez sur le bouton ci-dessous pour en choisir un nouveau&nbsp;:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:6px;background-color:#0075c3;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;color:#888888;font-size:13px;">Ce lien expire dans 1 heure.</p>
              <p style="margin:0;color:#888888;font-size:13px;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9f9;padding:20px 40px;border-top:1px solid #eeeeee;">
              <p style="margin:0;color:#aaaaaa;font-size:12px;">
                &copy; Puna — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
