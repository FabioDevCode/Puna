/**
 * Configuration CORS — stratégie hybride
 *
 * /api/*  → CORS ouvert : les sites clients externes postent leurs formulaires
 *           depuis n'importe quel domaine (pas de cookies, pas de credentials).
 *
 * Routes web (/dashboard, /admin, etc.) → aucun middleware CORS appliqué.
 *           Elles sont protégées par les sessions + CSRF (same-origin uniquement).
 */

/**
 * Configuration pour les routes API publiques (/api/*)
 *
 * - origin: '*'         → accepte toutes les origines (formulaires clients sur n'importe quel domaine)
 * - methods             → POST pour les soumissions + OPTIONS pour le preflight
 * - credentials: false  → pas de cookies cross-origin
 * - allowedHeaders      → headers utilisés par l'API Puna
 */
export const corsApiPublic = {
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-KEY-PUNA'],
    // Mise en cache du preflight OPTIONS pendant 10 minutes (évite les requêtes répétées)
    maxAge: 600,
};
