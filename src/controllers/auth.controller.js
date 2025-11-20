import bcrypt from 'bcrypt';
import passport from 'passport';
import models from '../models/index.js';

export const dpFirstCoPost = async (req, res) => {
    const { login, password, confirm_password } = req.body;
    try {
        const user = await models.User.findOne({
            where: {
                login,
                enabled: false
            }
        });
        if (!user) {
            return res.render('first_co', {
                layout: 'login',
                error: 'Login inconnu.'
            });
        }
        if (password !== confirm_password) {
            return res.render('first_co', {
                layout: 'login',
                error: 'Les mots de passe ne correspondent pas.'
            });
        }
        const hash = await bcrypt.hash(password, 10);
        await user.update({ password: hash, enabled: true });
        return res.redirect('/dp-login');
    } catch (err) {
        return res.render('first_co', {
            layout: 'login',
            error: 'Erreur lors de la mise à jour du mot de passe.'
        });
    }
};

export const dpConnect = (req, res) => {
    passport.authenticate('local', async (err, user, _) => {
        if (err || !user) {
            return res.redirect('/dp-login');
        }

        try {
            await models.User.update({
                last_connection: new Date()
            }, {
                where: {
                    id: user.id
                }
            });
        } catch (e) {
            console.error('Failed to update last_connection for user', user && user.id, e);
        }

        req.session.user = {
            id: user.id,
            login: user.login,
            email: user.email
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
