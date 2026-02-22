import passport from 'passport';
import { auditLogger, errorLogger } from '../config/logger.js';
import { findUserByLogin, activateUserAccount } from '../services/auth.service.js';
import { updateLastConnection } from '../services/user.service.js';

export const dpFirstCoPost = async (req, res) => {
    const { login, password, confirm_password } = req.body;
    const ip = req.ip;

    try {
        // Rechercher l'utilisateur via le service
        const user = await findUserByLogin(login, 'pending');

        if (!user) {
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

            res.flash('error', 'Identifiants incorrects.');
            return res.redirect('/dp-login');
        }

        try {
            // Mettre à jour last_connection via le service
            await updateLastConnection(user.id);
        } catch (e) {
            errorLogger.error({ err: e, userId: user?.id }, 'Failed to update last_connection');
        }

        // Log de la connexion réussie
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
