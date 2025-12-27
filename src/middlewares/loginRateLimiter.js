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
