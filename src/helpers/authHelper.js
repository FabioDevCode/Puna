import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import models from '../models/index.js';

export function initializePassport() {
    passport.use(
        new LocalStrategy(
            {
                usernameField: 'login',
                passwordField: 'password',
                passReqToCallback: true
            },
            async (req, login, password, done) => {
                try {
                    const user = await models.User.findOne({ where: { login, enabled: true } });
                    if (!user) {return done(null, false, { message: 'Utilisateur non trouvé ou non activé' });}
                    const isValid = await bcrypt.compare(password, user.password);
                    if (!isValid) {return done(null, false, { message: 'Mot de passe incorrect' });}
                    return done(null, user);
                } catch (err) {
                    return done(err);
                }
            }
        )
    );

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await models.User.findByPk(id);
            done(null, user || false);
        } catch (err) {
            done(err);
        }
    });
}

export function isConnected(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/dp-login');
}

export function isConnectDash(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    } else {
        return next();
    }
}
