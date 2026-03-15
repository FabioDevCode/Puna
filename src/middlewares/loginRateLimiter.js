/**
 * Rate Limiter pour les routes d'authentification
 * Protège contre les attaques par force brute
 */

import rateLimit from 'express-rate-limit';
import { auditLogger } from '../config/logger.js';

/**
 * Rate limiter spécifique pour la page de login
 * Maximum 5 tentatives par fenêtre de 15 minutes
 */
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
    max: 5, // Maximum 5 tentatives par fenêtre
    standardHeaders: true,
    legacyHeaders: false,

    // Ne pas compter les requêtes réussies
    skipSuccessfulRequests: true,

    // Identifier par IP + login pour plus de précision
    keyGenerator: (req) => {
        const login = req.body?.login || 'anonymous';
        return `login:${req.ip}:${login}`;
    },

    // Handler personnalisé pour les dépassements
    handler: (req, res) => {
        auditLogger.warn({
            action: 'LOGIN_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            login: req.body?.login || 'unknown',
            userAgent: req.get('User-Agent'),
        });

        res.flash('error', 'Trop de tentatives de connexion. Réessayez dans 15 minutes.');
        return res.redirect('/dp-login');
    },

    // Désactiver la validation IPv6 (on utilise l'IP telle quelle)
    validate: { keyGeneratorIpFallback: false },
});

/**
 * Rate limiter pour la première connexion (activation de compte)
 * Plus strict : 3 tentatives par fenêtre de 15 minutes
 */
export const firstLoginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
    max: 3, // Maximum 3 tentatives
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const login = req.body?.login || 'anonymous';
        return `first-login:${req.ip}:${login}`;
    },

    handler: (req, res) => {
        auditLogger.warn({
            action: 'FIRST_LOGIN_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            login: req.body?.login || 'unknown',
            userAgent: req.get('User-Agent'),
        });

        res.flash('error', 'Trop de tentatives. Réessayez dans 15 minutes.');
        return res.redirect('/dp-first-connexion');
    },

    // Désactiver la validation IPv6
    validate: { keyGeneratorIpFallback: false },
});

/**
 * Rate limiter pour la demande de réinitialisation de mot de passe
 * Limite à 3 demandes par fenêtre de 15 minutes (anti-énumération d'emails)
 */
export const forgotPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
    max: 3, // Maximum 3 demandes
    standardHeaders: true,
    legacyHeaders: false,

    // Compter toutes les requêtes (anti-énumération : on retourne toujours la même réponse)
    skipSuccessfulRequests: false,

    // Identifier par IP uniquement (l'email peut ne pas exister)
    keyGenerator: (req) => {
        return `forgot-pwd:${req.ip}`;
    },

    handler: (req, res) => {
        auditLogger.warn({
            action: 'FORGOT_PASSWORD_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            email: req.body?.email,
            userAgent: req.get('User-Agent'),
        });

        res.flash('error', 'Trop de demandes. Réessayez dans 15 minutes.');
        return res.redirect('/dp-forgot-password');
    },

    // Désactiver la validation IPv6
    validate: { keyGeneratorIpFallback: false },
});

/**
 * Rate limiter pour la vérification 2FA (TOTP et codes de récupération)
 * Maximum 5 tentatives par fenêtre de 15 minutes
 */
export const twoFaRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,

    keyGenerator: (req) => {
        const userId = req.session?.pending2FA?.userId || 'unknown';
        return `2fa:${req.ip}:${userId}`;
    },

    handler: (req, res) => {
        auditLogger.warn({
            action: '2FA_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            userId: req.session?.pending2FA?.userId || 'unknown',
            userAgent: req.get('User-Agent'),
        });

        res.flash('error', 'Trop de tentatives de vérification. Réessayez dans 15 minutes.');
        return res.redirect('/dp-2fa-verify');
    },

    validate: { keyGeneratorIpFallback: false },
});

/**
 * Rate limiter pour la réinitialisation effective du mot de passe
 * Limite à 5 tentatives par fenêtre de 15 minutes
 */
export const resetPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
    max: 5, // Maximum 5 tentatives
    standardHeaders: true,
    legacyHeaders: false,

    // Identifier par IP uniquement
    keyGenerator: (req) => {
        return `reset-pwd:${req.ip}`;
    },

    handler: (req, res) => {
        auditLogger.warn({
            action: 'RESET_PASSWORD_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        });

        res.flash('error', 'Trop de tentatives. Réessayez dans 15 minutes.');
        return res.redirect('/dp-forgot-password');
    },

    // Désactiver la validation IPv6
    validate: { keyGeneratorIpFallback: false },
});
