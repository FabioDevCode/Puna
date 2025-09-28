import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import models from '../models/index.js';

// Initialisation de Passport
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
					const user = users.find(u => u.login === login);
					if (!user) return done(null, false, { message: 'Utilisateur non trouvé' });

					const isValid = await bcrypt.compare(password, user.passwordHash);
					if (!isValid) return done(null, false, { message: 'Mot de passe incorrect' });


					// Mettre les données du user dans req.session.user

					return done(null, user);
				} catch (err) {
					return done(err);
				}
        	}
        )
    );

    // Sérialisation de l'utilisateur
    passport.serializeUser((user, done) => done(null, user.id));

    // Désérialisation de l'utilisateur
    passport.deserializeUser((id, done) => {
        const user = users.find(u => u.id === id);
        done(null, user || false);
    });
}

