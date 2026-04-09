/**
 * ================================================================
 * SESSION STORE — Référence partagée
 * ================================================================
 * Permet d'accéder au session store (express-mysql-session) depuis
 * les services sans import circulaire avec app.js.
 *
 * - setSessionStore() est appelé dans app.js après la création du store
 * - getSessionStore() est utilisé dans les services (ex : session.service.js)
 * - En mode SQLite (tests E2E), le store n'est pas défini (MemoryStore)
 *   et getSessionStore() retourne null.
 * ================================================================
 */

let _sessionStore = null;

/**
 * @param {import('express-mysql-session').MySQLStore | null} store
 */
export function setSessionStore(store) {
    _sessionStore = store || null;
}

/**
 * @returns {import('express-mysql-session').MySQLStore | null}
 */
export function getSessionStore() {
    return _sessionStore;
}
