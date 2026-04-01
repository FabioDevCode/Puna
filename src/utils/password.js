/**
 * Critères de validation du mot de passe.
 * Chaque entrée associe un test (regex ou condition) à une clé i18n d'erreur.
 */
const PASSWORD_RULES = [
    {
        test: (pwd) => typeof pwd === 'string' && pwd.length >= 16,
        errorKey: 'password.min_length',
    },
    {
        test: (pwd) => /[A-Z]/.test(pwd),
        errorKey: 'password.needs_uppercase',
    },
    {
        test: (pwd) => /[a-z]/.test(pwd),
        errorKey: 'password.needs_lowercase',
    },
    {
        test: (pwd) => /[0-9]/.test(pwd),
        errorKey: 'password.needs_digit',
    },
    {
        test: (pwd) => /[^A-Za-z0-9]/.test(pwd),
        errorKey: 'password.needs_special',
    },
];

/**
 * Valide la force d'un mot de passe.
 * @param {string} password - Le mot de passe à valider
 * @returns {{ valid: boolean, errors: string[] }} - `valid` est true si tous les critères sont remplis.
 *   `errors` contient les clés i18n des critères non respectés.
 */
export function validatePasswordStrength(password) {
    if (typeof password !== 'string') {
        return { valid: false, errors: PASSWORD_RULES.map((rule) => rule.errorKey) };
    }

    const errors = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.errorKey);

    return { valid: errors.length === 0, errors };
}
