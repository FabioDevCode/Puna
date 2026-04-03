/**
 * ================================================================
 * MIDDLEWARE DE VÉRIFICATION DU STATUT UTILISATEUR
 * ================================================================
 * Vérifie à chaque requête authentifiée que le statut de l'utilisateur
 * en base de données est toujours `active`. Si ce n'est plus le cas,
 * la session est détruite et l'utilisateur est redirigé vers /dp-login.
 *
 * Optimisation : la vérification BDD n'est effectuée que toutes les
 * STATUS_CHECK_TTL_MS millisecondes (défaut : 60 secondes) afin de
 * limiter le nombre de requêtes.
 * ================================================================
 */

import { auditLogger } from '../config/logger.js';
import { getUserStatus } from '../services/user.service.js';

/**
 * Durée de vie du cache de statut en millisecondes (configurable via env)
 * Défaut : 60 000 ms (60 secondes)
 */
export const STATUS_CHECK_TTL_MS = parseInt(process.env.STATUS_CHECK_TTL_MS || '60000', 10);

/**
 * Messages flash selon le statut de l'utilisateur
 * Les clés correspondent aux sections i18n dans fr.json / en.json
 */
const STATUS_MESSAGE_KEYS = {
    inactive: 'flash.status_inactive',
    suspended: 'flash.status_suspended',
    banned: 'flash.status_banned',
    anonymized: 'flash.status_anonymized',
};

/**
 * Middleware de vérification du statut utilisateur
 *
 * Doit être placé après `isConnected` dans la chaîne de middlewares.
 * Suppose que `req.session.user` existe et contient au moins `id` et `login`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function checkUserStatus(req, res, next) {
    const sessionUser = req.session?.user;

    // Si pas d'utilisateur en session, laisser passer (isConnected gère ce cas)
    if (!sessionUser) {
        return next();
    }

    const now = Date.now();
    const lastChecked = req.session.statusCheckedAt || 0;

    // Cache TTL : ne pas re-vérifier si la dernière vérification est récente
    if (now - lastChecked < STATUS_CHECK_TTL_MS) {
        return next();
    }

    try {
        const status = await getUserStatus(sessionUser.id);

        // Utilisateur inexistant en BDD
        if (status === null) {
            return invalidateSession(req, res, 'anonymized', sessionUser);
        }

        // Statut actif : mettre à jour le timestamp et continuer
        if (status === 'active') {
            req.session.statusCheckedAt = now;
            return next();
        }

        // Statut non-actif : invalider la session
        return invalidateSession(req, res, status, sessionUser);
    } catch (err) {
        // En cas d'erreur BDD, on laisse passer pour éviter de bloquer l'application
        auditLogger.error(
            {
                action: 'SESSION_STATUS_CHECK_ERROR',
                userId: sessionUser.id,
                userLogin: sessionUser.login,
                ip: req.ip,
                error: err.message,
            },
            'checkUserStatus: erreur lors de la vérification du statut'
        );
        return next();
    }
}

/**
 * Invalide la session, journalise l'événement et redirige vers /dp-login
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} status - Statut qui a déclenché l'invalidation
 * @param {{ id: string, login: string }} sessionUser - Données de l'utilisateur en session
 */
function invalidateSession(req, res, status, sessionUser) {
    auditLogger.warn({
        action: 'SESSION_INVALIDATED_BY_STATUS',
        userId: sessionUser.id,
        userLogin: sessionUser.login,
        status,
        ip: req.ip,
        timestamp: new Date().toISOString(),
    });

    const messageKey = STATUS_MESSAGE_KEYS[status] || 'flash.session_invalidated';
    const flashMessage = res.__?.(messageKey) || req.__?.(messageKey) || messageKey;

    // Définir le message flash avant la destruction de la session
    if (typeof res.flash === 'function') {
        res.flash('error', flashMessage);
    }

    req.session.destroy(() => {
        res.redirect('/dp-login');
    });
}

export default checkUserStatus;
