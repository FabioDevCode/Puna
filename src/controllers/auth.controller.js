import passport from 'passport';
import { auditLogger, errorLogger } from '../config/logger.js';
import { activateUserAccount, findUserByLogin } from '../services/auth.service.js';
import { incrementFailedAttempts, resetFailedAttempts, updateLastConnection } from '../services/user.service.js';
import { validatePasswordStrength } from '../utils/password.js';

export const dpFirstCoPost = async (req, res) => {
    const { login, password, confirm_password } = req.body;
    const ip = req.ip;

    try {
        // Rechercher l'utilisateur via le service
        const user = await findUserByLogin(login, 'pending');

        if (!user) {
            // Check if user exists but is banned
            const foundUser = await findUserByLogin(login);
            if (foundUser && foundUser.status === 'banned') {
                auditLogger.warn({
                    action: 'FIRST_LOGIN_FAILED',
                    ip,
                    login: login || 'unknown',
                    reason: 'user_banned',
                });
                return res.render('auth/first-login', {
                    layout: 'auth',
                    error: 'Votre compte a été banni.',
                });
            }
            auditLogger.warn({
                action: 'FIRST_LOGIN_FAILED',
                ip,
                login: login || 'unknown',
                reason: 'user_not_found',
            });
            return res.render('auth/first-login', {
                layout: 'auth',
                error: 'Login inconnu.',
            });
        }
        if (password !== confirm_password) {
            auditLogger.warn({
                action: 'FIRST_LOGIN_FAILED',
                ip,
                login,
                reason: 'password_mismatch',
            });
            return res.render('auth/first-login', {
                layout: 'auth',
                error: 'Les mots de passe ne correspondent pas.',
            });
        }

        // Valider la force du mot de passe
        const { valid, errors } = validatePasswordStrength(password);
        if (!valid) {
            auditLogger.warn({
                action: 'FIRST_LOGIN_FAILED',
                ip,
                login,
                reason: 'weak_password',
            });
            return res.render('auth/first-login', {
                layout: 'auth',
                error: req.__('password.too_weak'),
                passwordErrors: errors.map((key) => req.__(key)),
            });
        }

        // Activer le compte via le service
        await activateUserAccount(user.id, password);

        auditLogger.info({
            action: 'FIRST_LOGIN_SUCCESS',
            userId: user.id,
            login,
            ip,
        });

        res.flash('success', 'Compte activé ! Vous pouvez maintenant vous connecter.');
        return res.redirect('/dp-login');
    } catch (err) {
        auditLogger.error({
            action: 'FIRST_LOGIN_ERROR',
            ip,
            login: login || 'unknown',
            error: err.message,
        });
        return res.render('auth/first-login', {
            layout: 'auth',
            error: 'Erreur lors de la mise à jour du mot de passe.',
        });
    }
};

export const dpConnect = (req, res) => {
    const { login } = req.body;
    const ip = req.ip;

    passport.authenticate('local', async (err, user, _) => {
        if (err || !user) {
            // Log de l'échec de connexion
            auditLogger.warn({
                action: 'LOGIN_FAILED',
                ip,
                login: login || 'unknown',
                userAgent: req.get('User-Agent'),
                reason: err ? 'error' : 'invalid_credentials',
            });

            // Identify the reason for failure to provide a more specific message
            let flashMsg = 'Identifiants incorrects.';
            try {
                const existingUser = await findUserByLogin(login);
                if (existingUser && existingUser.status !== 'anonymized') {
                    if (existingUser.status === 'banned') {
                        flashMsg = 'Votre compte a été banni.';
                    } else if (existingUser.status === 'suspended') {
                        flashMsg = 'Votre compte est suspendu suite à de trop nombreuses tentatives de connexion. Contactez un administrateur.';
                    } else if (existingUser.status === 'inactive') {
                        flashMsg = 'Votre compte est désactivé. Contactez un administrateur.';
                    } else {
                        // Increment the failed attempts counter (may trigger auto-suspension)
                        await incrementFailedAttempts(existingUser.id, existingUser.login, ip);
                    }
                }
            } catch (_e) {
                // ignore — use default message
            }

            res.flash('error', flashMsg);
            return res.redirect('/dp-login');
        }

        try {
            // Reset failed login counter on successful login
            await resetFailedAttempts(user.id);
        } catch (e) {
            errorLogger.error({ err: e, userId: user?.id }, 'Failed to reset failed_login_attempts');
        }

        try {
            // Mettre à jour last_connection via le service
            await updateLastConnection(user.id);
        } catch (e) {
            errorLogger.error({ err: e, userId: user?.id }, 'Failed to update last_connection');
        }

        // Vérifier si la 2FA est requise pour cet utilisateur
        const isTotpActive = process.env.TOTP_ENABLED === 'true' && user.totp_enabled === true;

        if (isTotpActive) {
            // Session intermédiaire — l'utilisateur doit encore valider son code TOTP
            req.session.pending2FA = {
                userId: user.id,
                login: user.login,
                email: user.email,
                role: user.role,
                status: user.status,
            };

            auditLogger.info({
                action: 'LOGIN_2FA_PENDING',
                userId: user.id,
                login: user.login,
                ip,
                userAgent: req.get('User-Agent'),
            });

            return res.redirect('/dp-2fa-verify');
        }

        // Pas de 2FA — connexion directe (flux existant inchangé)
        auditLogger.info({
            action: 'LOGIN_SUCCESS',
            userId: user.id,
            login: user.login,
            ip,
            userAgent: req.get('User-Agent'),
        });

        req.session.user = {
            id: user.id,
            login: user.login,
            email: user.email,
            role: user.role,
            status: user.status,
        };
        return res.redirect('/dashboard');
    })(req, res);
};

export const dpLogout = (req, res) => {
    const user = req.session?.user;
    const ip = req.ip;

    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }

        // Log de la déconnexion
        if (user) {
            auditLogger.info({
                action: 'LOGOUT',
                userId: user.id,
                login: user.login,
                ip,
            });
        }

        res.clearCookie('puna');
        return res.redirect('/dp-login');
    });
};
