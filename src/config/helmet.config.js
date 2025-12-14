/**
 * Configuration Helmet.js - Sécurité HTTP Headers
 * Protection contre XSS, clickjacking, et autres vulnérabilités web
 */

import helmet from 'helmet';

const enableHSTS = process.env.HELMET_STRICT_TRANSPORT === 'true';

/**
 * Configuration Helmet pour les routes WEB authentifiées
 * Protection complète avec Content Security Policy (CSP)
 */
export const webHelmet = helmet({
    contentSecurityPolicy: {
        directives: {
            // Par défaut, autoriser uniquement les ressources du même domaine
            defaultSrc: ["'self'"],

            // Scripts: CDN + inline nécessaire pour certains composants
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Nécessaire pour scripts inline (charts, etc.)
                'cdn.jsdelivr.net', // TailwindCSS/DaisyUI
                'cdnjs.cloudflare.com', // Font Awesome
            ],

            // Styles: CDN + inline nécessaire pour Tailwind
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Nécessaire pour Tailwind et styles inline
                'cdn.jsdelivr.net',
                'cdnjs.cloudflare.com',
                'fonts.googleapis.com', // Google Fonts
            ],

            // Images: même domaine + data URLs + blob URLs
            imgSrc: ["'self'", 'data:', 'blob:'],

            // Connexions API: uniquement vers le même domaine
            connectSrc: ["'self'"],

            // Fonts: CDN + data URLs
            fontSrc: ["'self'", 'cdnjs.cloudflare.com', 'fonts.gstatic.com', 'data:'],

            // Interdire les iframes
            frameSrc: ["'none'"],

            // Interdire les objets/embeds (Flash, etc.)
            objectSrc: ["'none'"],

            // Forcer HTTPS en production
            ...(enableHSTS && { upgradeInsecureRequests: [] }),
        },
    },

    // Permettre les ressources cross-origin (CDN)
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // Strict Transport Security: forcer HTTPS
    strictTransportSecurity: enableHSTS
        ? {
              maxAge: 31536000, // 1 an
              includeSubDomains: true,
              preload: true,
          }
        : false, // Désactivé en dev (pas de HTTPS local)
});

/**
 * Configuration Helmet pour les routes API publiques
 * Protection légère sans CSP strict pour ne pas bloquer les appels externes
 */
export const apiHelmet = helmet({
    // Désactiver CSP pour les API (sinon bloque les appels cross-origin)
    contentSecurityPolicy: false,

    // Permettre les ressources cross-origin
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // HSTS uniquement en production
    strictTransportSecurity: enableHSTS
        ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
          }
        : false,
});

/**
 * Middleware conditionnel pour appliquer la bonne configuration Helmet
 * Routes API/Send → Helmet léger
 * Routes Web → Helmet complet avec CSP
 */
export const helmetMiddleware = (req, res, next) => {
    // Routes API et formulaires publics: helmet léger
    if (req.path.startsWith('/api') || req.path.startsWith('/send')) {
        return apiHelmet(req, res, next);
    }

    // Routes web authentifiées: helmet complet
    webHelmet(req, res, next);
};
