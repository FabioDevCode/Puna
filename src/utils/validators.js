/**
 * Fonctions de validation pour les inputs métier.
 */

/**
 * Valide un nom de domaine.
 * - Longueur : 1 à 253 caractères
 * - Format : domaine FQDN valide (lettres, chiffres, tirets, au moins un point, TLD ≥ 2 lettres)
 * - Pas d'espaces
 *
 * @param {string} domain
 * @returns {{ valid: boolean, error: string|null }} — `error` contient une clé i18n
 */
export function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return { valid: false, error: 'validation.domain_required' };
    }

    const trimmed = domain.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'validation.domain_required' };
    }

    if (trimmed.length > 253) {
        return { valid: false, error: 'validation.domain_too_long' };
    }

    // Regex FQDN : labels alphanumériques séparés par des points, TLD ≥ 2 lettres
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(trimmed)) {
        return { valid: false, error: 'validation.domain_invalid_format' };
    }

    return { valid: true, error: null };
}

/**
 * Valide un nom de formulaire.
 * - Longueur : 1 à 50 caractères (cohérent avec le maxlength de la vue)
 * - Caractères autorisés : lettres (unicode), chiffres, espaces, tirets, underscores, points
 * - Trim automatique
 *
 * @param {string} name
 * @returns {{ valid: boolean, error: string|null }} — `error` contient une clé i18n
 */
export function isValidFormName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'validation.form_name_required' };
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'validation.form_name_required' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'validation.form_name_too_long' };
    }

    // Autorise lettres (unicode), chiffres, espaces, tirets, underscores, points
    const nameRegex = /^[\p{L}\p{N}\s\-_.]+$/u;
    if (!nameRegex.test(trimmed)) {
        return { valid: false, error: 'validation.form_name_invalid_chars' };
    }

    return { valid: true, error: null };
}
