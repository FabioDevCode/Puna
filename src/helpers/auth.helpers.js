import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import checkUserStatus from '../middlewares/checkUserStatus.js';
import models from '../models/index.js';

export function initializePassport() {
    passport.use(
        new LocalStrategy(
            {
                usernameField: 'login',
                passwordField: 'password',
                passReqToCallback: true,
            },
            async (req, login, password, done) => {
                try {
                    const user = await models.User.findOne({
                        where: {
                            login,
                            status: 'active',
                        },
                    });

                    if (!user) {
                        return done(null, false, {
                            message: 'Utilisateur non trouvé ou non activé',
                        });
                    }
                    const isValid = await bcrypt.compare(password, user.password);

                    if (!isValid) {
                        return done(null, false, {
                            message: 'Mot de passe incorrect',
                        });
                    }
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
            // Convertir l'objet Sequelize en objet JavaScript simple
            done(null, user ? user.toJSON() : false);
        } catch (err) {
            done(err);
        }
    });
}

export function isConnected(req, res, next) {
    if (req.session?.user) {
        return next();
    }
    return res.redirect('/dp-login');
}

export function requireAuth(req, res, next) {
    // Note: req.session.pending2FA (état intermédiaire 2FA) ne passe PAS ce guard,
    // seule une session complète (req.session.user) est acceptée.
    if (!req.session?.user) {
        return res.redirect('/dp-login');
    }
    return checkUserStatus(req, res, next);
}

/**
 * Guard pour les routes de vérification 2FA.
 * Vérifie que la session contient un état "pending2FA" (mot de passe validé, TOTP en attente).
 * Redirige vers /dp-login si absent.
 */
export function requirePending2FA(req, res, next) {
    if (req.session?.pending2FA) {
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
