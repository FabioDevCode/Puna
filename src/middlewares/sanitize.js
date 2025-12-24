/**
 * Middleware de sanitization des entrées utilisateur
 * Protège contre les attaques XSS en nettoyant les données de req.body
 */

import xss from 'xss';

// Options XSS - configuration stricte par défaut
const xssOptions = {
    whiteList: {}, // Aucune balise HTML autorisée
    stripIgnoreTag: true, // Supprime les balises non autorisées
    stripIgnoreTagBody: ['script', 'style'], // Supprime le contenu de script et style
};

/**
 * Sanitize une valeur string avec xss
 * @param {string} value - Valeur à nettoyer
 * @returns {string} - Valeur nettoyée
 */
const sanitizeString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return xss(value, xssOptions);
};

/**
 * Sanitize récursivement un objet ou tableau
 * @param {any} data - Données à nettoyer
 * @returns {any} - Données nettoyées
 */
const sanitizeData = (data) => {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        return sanitizeString(data);
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeData(item));
    }

    if (typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Sanitize aussi les clés (protection contre injection dans les noms de champs)
            const sanitizedKey = sanitizeString(key);
            sanitized[sanitizedKey] = sanitizeData(value);
        }
        return sanitized;
    }

    // Pour les autres types (number, boolean, etc.), retourner tel quel
    return data;
};

/**
 * Middleware Express pour sanitizer req.body
 * À placer après les parsers (express.json, express.urlencoded)
 */
export const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeData(req.body);
    }
    next();
};

/**
 * Middleware Express pour sanitizer req.query
 */
export const sanitizeQuery = (req, res, next) => {
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeData(req.query);
    }
    next();
};

/**
 * Middleware Express pour sanitizer req.params
 */
export const sanitizeParams = (req, res, next) => {
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeData(req.params);
    }
    next();
};

/**
 * Middleware combiné qui sanitize body, query et params
 */
export const sanitizeAll = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeData(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeData(req.query);
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeData(req.params);
    }
    next();
};

export default sanitizeAll;
