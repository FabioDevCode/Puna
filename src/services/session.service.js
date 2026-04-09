/**
 * ================================================================
 * SERVICE DE GESTION DES SESSIONS
 * ================================================================
 * Permet de purger les sessions d'un utilisateur directement dans
 * le store MySQL. Utilisé lors d'un bannissement, d'une anonymisation
 * ou d'une suppression pour invalider immédiatement la session
 * sans attendre le TTL du middleware checkUserStatus.
 * ================================================================
 */

import { auditLogger, errorLogger } from '../config/logger.js';
import { getSessionStore } from '../config/sessionStore.js';

/**
 * Supprime toutes les sessions actives d'un utilisateur dans le store MySQL.
 *
 * - En mode SQLite / MemoryStore (tests E2E), la fonction est un no-op silencieux.
 * - Les erreurs SQL sont loguées mais ne sont pas propagées pour ne pas
 *   bloquer l'action admin (bannissement, suppression, etc.).
 *
 * @param {string} userId - ID de l'utilisateur dont les sessions doivent être purgées
 * @returns {Promise<number>} - Nombre de sessions supprimées (0 si store indisponible)
 */
export async function destroyUserSessions(userId) {
    const store = getSessionStore();

    if (!store) {
        return 0;
    }

    try {
        const result = await store.query('DELETE FROM sessions WHERE JSON_EXTRACT(data, ?) = ?', ['$.user.id', userId]);

        const deletedCount = result?.affectedRows ?? 0;

        if (deletedCount > 0) {
            auditLogger.info({
                action: 'USER_SESSIONS_PURGED',
                userId,
                deletedSessions: deletedCount,
                timestamp: new Date().toISOString(),
            });
        }

        return deletedCount;
    } catch (err) {
        errorLogger.error(
            {
                action: 'USER_SESSIONS_PURGE_ERROR',
                userId,
                error: err.message,
            },
            'destroyUserSessions: erreur lors de la purge des sessions'
        );
        return 0;
    }
}
