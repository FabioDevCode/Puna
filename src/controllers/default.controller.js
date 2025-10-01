import bcrypt from 'bcrypt';
import passport from 'passport';
import models from '../models/index.js';

export const dashboard = (req, res) => {
    res.render('dashboard');
};

export const error = async(req, res) => {
    res.render('error', {
        layout: false,
    })
};

export const dpLogin = (req, res) => {
    res.render('login', {
        layout: "login"
    })
};

export const dpFirstCo = (req, res) => {
    res.render('first_co', {
        layout: "login"
    })
};

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
                layout: "login",
                error: "Login inconnu."
            });
        };

        if (password !== confirm_password) {
            return res.render('first_co', {
                layout: "login",
                error: "Les mots de passe ne correspondent pas."
            });
        };

        const hash = await bcrypt.hash(password, 10);
        await user.update({ password: hash, enabled: true });
        return res.redirect('/dp-login');
    } catch (err) {
        return res.render('first_co', {
            layout: "login",
            error: "Erreur lors de la mise à jour du mot de passe."
        });
    }
};

export const dpConnect = (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err || !user) {
            return res.redirect('/dp-login');
        }
        req.session.user = {
            id: user.id,
            login: user.login,
            email: user.email
        };
        return res.redirect('/dashboard');
    })(req, res, next);
};


