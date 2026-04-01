import { auditLogger, errorLogger } from '../config/logger.js';
import { mailEnabled } from '../config/mailer.js';
import { createPasswordResetRequest, validateResetToken, resetPassword } from '../services/passwordReset.service.js';
import { validatePasswordStrength } from '../utils/password.js';

export const forgotPasswordGet = (req, res) => {
    res.render('auth/forgot-password', {
        layout: 'auth',
        mailEnabled,
    });
};

export const forgotPasswordPost = async (req, res) => {
    const { email } = req.body;
    const ip = req.ip;

    if (!mailEnabled) {
        res.flash('error', 'Le service de messagerie est désactivé. Contactez un administrateur.');
        return res.redirect('/dp-forgot-password');
    }

    if (!email || email.trim() === '') {
        res.flash('error', 'Veuillez saisir une adresse email.');
        return res.redirect('/dp-forgot-password');
    }

    try {
        await createPasswordResetRequest(email);
        res.flash('success', 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé.');
        return res.redirect('/dp-forgot-password');
    } catch (err) {
        errorLogger.error({ err, ip, email }, 'Error during forgot password request');
        res.flash('error', 'Une erreur est survenue. Veuillez réessayer.');
        return res.redirect('/dp-forgot-password');
    } finally {
        auditLogger.info({
            action: 'FORGOT_PASSWORD_ATTEMPT',
            ip,
            email: email || 'unknown',
        });
    }
};

export const resetPasswordGet = async (req, res) => {
    const { token } = req.params;

    try {
        const user = await validateResetToken(token);

        if (!user) {
            res.flash('error', 'Le lien de réinitialisation est invalide ou a expiré.');
            return res.redirect('/dp-forgot-password');
        }

        return res.render('auth/reset-password', {
            layout: 'auth',
            token,
        });
    } catch (err) {
        errorLogger.error({ err }, 'Error during reset token validation');
        res.flash('error', 'Une erreur est survenue. Veuillez réessayer.');
        return res.redirect('/dp-forgot-password');
    }
};

export const resetPasswordPost = async (req, res) => {
    const { token } = req.params;
    const { password, confirm_password } = req.body;

    if (!password || password.trim() === '') {
        res.flash('error', 'Veuillez saisir un mot de passe.');
        return res.redirect(`/dp-reset-password/${token}`);
    }

    if (password !== confirm_password) {
        res.flash('error', 'Les mots de passe ne correspondent pas.');
        return res.redirect(`/dp-reset-password/${token}`);
    }

    // Valider la force du mot de passe
    const { valid, errors } = validatePasswordStrength(password);
    if (!valid) {
        return res.render('auth/reset-password', {
            layout: 'auth',
            token,
            error: req.__('password.too_weak'),
            passwordErrors: errors.map((key) => req.__(key)),
        });
    }

    try {
        const result = await resetPassword(token, password);

        if (!result) {
            res.flash('error', 'Le lien de réinitialisation est invalide ou a expiré.');
            return res.redirect('/dp-forgot-password');
        }

        res.flash('success', 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.');
        return res.redirect('/dp-login');
    } catch (err) {
        errorLogger.error({ err }, 'Error during password reset');
        res.flash('error', 'Une erreur est survenue. Veuillez réessayer.');
        return res.redirect('/dp-forgot-password');
    }
};
