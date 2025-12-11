import passport from 'passport';
import { findUserByLogin, activateUserAccount } from '../services/auth.service.js';
import { updateLastConnection } from '../services/user.service.js';

export const dpFirstCoPost = async (req, res) => {
    const { login, password, confirm_password } = req.body;
    try {
        // Rechercher l'utilisateur via le service
        const user = await findUserByLogin(login, 'pending');

        if (!user) {
            return res.render('auth/first-login', {
                layout: 'auth',
                error: 'Login inconnu.',
            });
        }
        if (password !== confirm_password) {
            return res.render('auth/first-login', {
                layout: 'auth',
                error: 'Les mots de passe ne correspondent pas.',
            });
        }

        // Activer le compte via le service
        await activateUserAccount(user.id, password);

        return res.redirect('/dp-login');
    } catch (err) {
        return res.render('auth/first-login', {
            layout: 'auth',
            error: 'Erreur lors de la mise à jour du mot de passe.',
        });
    }
};

export const dpConnect = (req, res) => {
    passport.authenticate('local', async (err, user, _) => {
        if (err || !user) {
            return res.redirect('/dp-login');
        }

        try {
            // Mettre à jour last_connection via le service
            await updateLastConnection(user.id);
        } catch (e) {
            console.error('Failed to update last_connection for user', user && user.id, e);
        }

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
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('puna');
        return res.redirect('/dp-login');
    });
};
