import fs from 'node:fs';
import net from 'node:net';

/**
 * Variables d'environnement obligatoires
 */
const REQUIRED_VARS = {
    // Base de données
    DB_IP: 'Database host address',
    DB_PORT: 'Database port',
    DB_USER: 'Database username',
    DB_PWD: 'Database password',
    DB_NAME: 'Database name',
    DB_DIALECT: 'Database dialect (mariadb, mysql, postgres)',

    // Sécurité - Clés de chiffrement
    KEY_TK: 'JWT signing key for API tokens',
    KEV: 'AES encryption key',
    KIV: 'AES initialization vector',
    SESSION_SECRET: 'Express session secret',
    CSRF_SECRET: 'CSRF protection secret key',
    API_KEY: 'API key for X-KEY-PUNA header authentication',

    // Application
    PORT: 'Server port number',
    NODE_ENV: 'Node environment (development, production, test)',
};

/**
 * Variables optionnelles avec valeurs par défaut
 */
const OPTIONAL_VARS = {
    SESSION_MAX_AGE: '43200000',
    HELMET_STRICT_TRANSPORT: 'false',
    APP_URL: 'http://localhost:3000',
    TOTP_ENABLED: 'false', // Active/désactive la fonctionnalité 2FA globalement
    TOTP_ISSUER: 'Puna', // Nom affiché dans l'application d'authentification
    ADMIN_LOGIN: '', // Login du premier administrateur (requis au premier démarrage)
    ADMIN_EMAIL: '', // Email du premier administrateur (optionnel)
};

/**
 * Variables SMTP optionnelles (toutes doivent être présentes pour activer la fonctionnalité mail)
 * Si absentes ou incomplètes, la feature de reset de mot de passe est désactivée.
 */
const SMTP_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

/**
 * Indique si la 2FA TOTP est activée globalement.
 * @returns {boolean}
 */
export function isTotpEnabled() {
    return process.env.TOTP_ENABLED === 'true';
}

/**
 * Indique si la configuration SMTP est complète et que la feature mail est disponible.
 * @returns {boolean}
 */
export function isMailConfigured() {
    return SMTP_VARS.every((key) => !!process.env[key]);
}

/**
 * Valeurs autorisées pour certaines variables
 */
const ALLOWED_VALUES = {
    NODE_ENV: ['development', 'production', 'test'],
    DB_DIALECT: ['mariadb', 'mysql', 'postgres', 'sqlite'],
};

/**
 * Vérifie si l'application tourne dans un container Docker
 */
function isRunningInDocker() {
    try {
        return fs.existsSync('/.dockerenv');
    } catch {
        return false;
    }
}

/**
 * Ping un service ClamAV via socket Unix ou TCP
 * @param {Object} options - { socket } ou { host, port }
 * @param {number} [timeout=3000] - Timeout en ms
 * @returns {Promise<boolean>} true si le service répond PONG
 */
function pingClamAV({ socket, host, port }, timeout = 3000) {
    return new Promise((resolve) => {
        const connectOpts = socket ? { path: socket } : { host, port };
        const client = net.createConnection(connectOpts);

        const timer = setTimeout(() => {
            client.destroy();
            resolve(false);
        }, timeout);

        client.once('connect', () => {
            client.write('PING\n');
        });

        client.once('data', (data) => {
            clearTimeout(timer);
            client.destroy();
            resolve(data.toString().trim() === 'PONG');
        });

        client.once('error', () => {
            clearTimeout(timer);
            client.destroy();
            resolve(false);
        });
    });
}

/**
 * Valide les variables d'environnement au démarrage
 * @throws {Error} Si des variables obligatoires manquent ou sont invalides
 */
export async function validateEnv() {
    const errors = [];
    const warnings = [];

    console.log('🔍 Validating environment variables...\n');

    // 1. Vérifier la présence des variables obligatoires
    for (const [key, description] of Object.entries(REQUIRED_VARS)) {
        if (!process.env[key]) {
            errors.push(`  ❌ ${key} - ${description}`);
        }
    }

    // Si des variables manquent, arrêter immédiatement
    if (errors.length > 0) {
        console.error('\n❌ Configuration Error: Missing required environment variables\n');
        errors.forEach((err) => console.error(err));
        console.error('\nPlease check your .env file.');
        console.error('See .env.example for reference.\n');
        process.exit(1);
    }

    // 2. Vérifier les formats et valeurs
    validateFormats(errors, warnings);

    // 3. Vérifier la sécurité des clés
    validateSecurityKeys(warnings);

    // 4. Validations spécifiques Docker
    if (isRunningInDocker()) {
        validateDockerConfig(warnings);
    }

    // 5. Afficher les résultats des validations statiques
    if (errors.length > 0) {
        console.error('\n❌ Configuration Error: Invalid environment variables\n');
        errors.forEach((err) => console.error(err));
        console.error('\nPlease fix the issues above.\n');
        process.exit(1);
    }

    // 6. Vérifier la connectivité ClamAV (si activé)
    if (process.env.CLAMAV_ENABLED === 'true') {
        await validateClamAVConnectivity(errors);
    }

    // 7. Résultat final
    if (errors.length > 0) {
        console.error('\n❌ Configuration Error: Service connectivity check failed\n');
        errors.forEach((err) => console.error(err));
        console.error('\nPlease fix the issues above.\n');
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.warn('⚠️  Configuration Warnings:\n');
        warnings.forEach((warn) => console.warn(warn));
        console.warn('');
    }

    // 8. Vérifier la configuration SMTP (optionnelle)
    validateSmtpConfig();

    console.log('✅ Environment variables validated successfully\n');
}

/**
 * Vérifie que le daemon ClamAV est accessible
 * - Si socket + host sont configurés → au moins un doit répondre
 * - Si un seul est configuré → celui-ci doit répondre
 */
async function validateClamAVConnectivity(errors) {
    const socketPath = (process.env.CLAMAV_SOCKET || '').trim();
    const host = (process.env.CLAMAV_HOST || '').trim();
    const port = parseInt(process.env.CLAMAV_PORT, 10) || 3310;

    const hasSocket = socketPath.length > 0;
    const hasHost = host.length > 0;

    // Aucun mode configuré (déjà géré dans validateFormats, mais sécurité supplémentaire)
    if (!hasSocket && !hasHost) {
        return;
    }

    console.log('🦠 Checking ClamAV connectivity...');

    const results = [];

    if (hasSocket) {
        const ok = await pingClamAV({ socket: socketPath });
        results.push({ mode: 'socket', target: socketPath, ok });
        console.log(ok ? `  ✅ Socket ${socketPath} → PONG` : `  ❌ Socket ${socketPath} → no response`);
    }

    if (hasHost) {
        const ok = await pingClamAV({ host, port });
        results.push({ mode: 'tcp', target: `${host}:${port}`, ok });
        console.log(ok ? `  ✅ TCP ${host}:${port} → PONG` : `  ❌ TCP ${host}:${port} → no response`);
    }

    const anyOk = results.some((r) => r.ok);

    if (!anyOk) {
        const targets = results.map((r) => `${r.mode} (${r.target})`).join(', ');
        errors.push(
            `  ❌ CLAMAV_ENABLED is "true" but the daemon is unreachable: ${targets}` +
                '\n     Make sure clamd is running and the socket/host is correct.' +
                '\n     To skip antivirus scanning, set CLAMAV_ENABLED=false.'
        );
    }
}

/**
 * Valide les formats et valeurs des variables
 */
function validateFormats(errors, _warnings) {
    // PORT doit être un nombre valide
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('  ❌ PORT must be a valid port number (1-65535)');
    }

    // DB_PORT doit être un nombre valide
    const dbPort = parseInt(process.env.DB_PORT);
    if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
        errors.push('  ❌ DB_PORT must be a valid port number (1-65535)');
    }

    // NODE_ENV doit être valide
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv && !ALLOWED_VALUES.NODE_ENV.includes(nodeEnv)) {
        errors.push(`  ❌ NODE_ENV must be one of: ${ALLOWED_VALUES.NODE_ENV.join(', ')}`);
    }

    // DB_DIALECT doit être valide
    const dbDialect = process.env.DB_DIALECT;
    if (dbDialect && !ALLOWED_VALUES.DB_DIALECT.includes(dbDialect)) {
        errors.push(`  ❌ DB_DIALECT must be one of: ${ALLOWED_VALUES.DB_DIALECT.join(', ')}`);
    }

    // SESSION_MAX_AGE doit être un nombre
    if (process.env.SESSION_MAX_AGE) {
        const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE);
        if (isNaN(sessionMaxAge)) {
            errors.push('  ❌ SESSION_MAX_AGE must be a number (milliseconds)');
        }
    }

    // HELMET_STRICT_TRANSPORT doit être true ou false
    if (process.env.HELMET_STRICT_TRANSPORT) {
        const hstsValue = process.env.HELMET_STRICT_TRANSPORT.toLowerCase();
        if (hstsValue !== 'true' && hstsValue !== 'false') {
            errors.push('  ❌ HELMET_STRICT_TRANSPORT must be "true" or "false"');
        }
    }

    // CLAMAV_ENABLED doit être true ou false (si défini)
    if (process.env.CLAMAV_ENABLED) {
        const clamEnabled = process.env.CLAMAV_ENABLED.toLowerCase();
        if (clamEnabled !== 'true' && clamEnabled !== 'false') {
            errors.push('  ❌ CLAMAV_ENABLED must be "true" or "false"');
        }

        // Si ClamAV est activé, au moins un mode de connexion doit être configuré
        if (clamEnabled === 'true') {
            const hasSocket = process.env.CLAMAV_SOCKET && process.env.CLAMAV_SOCKET.trim().length > 0;
            const hasHost = process.env.CLAMAV_HOST && process.env.CLAMAV_HOST.trim().length > 0;

            if (!hasSocket && !hasHost) {
                errors.push('  ❌ CLAMAV_ENABLED is "true" but no connection is configured.' + '\n     Set CLAMAV_SOCKET (Unix socket) or CLAMAV_HOST + CLAMAV_PORT (TCP).');
            }
        }
    }

    // CLAMAV_PORT doit être un nombre valide (si défini)
    if (process.env.CLAMAV_PORT) {
        const clamPort = parseInt(process.env.CLAMAV_PORT);
        if (isNaN(clamPort) || clamPort < 1 || clamPort > 65535) {
            errors.push('  ❌ CLAMAV_PORT must be a valid port number (1-65535)');
        }
    }

    // CLAMAV_SOCKET doit être un chemin absolu (si défini)
    if (process.env.CLAMAV_SOCKET) {
        const clamSocket = process.env.CLAMAV_SOCKET;
        if (!clamSocket.startsWith('/')) {
            errors.push('  ❌ CLAMAV_SOCKET must be an absolute path (e.g., /tmp/clamd.socket)');
        }
    }

    // SMTP_PORT doit être un nombre valide (si défini)
    if (process.env.SMTP_PORT) {
        const smtpPort = parseInt(process.env.SMTP_PORT);
        if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
            errors.push('  ❌ SMTP_PORT must be a valid port number (1-65535)');
        }
    }

    // KEV doit être une chaîne hex de 64 caractères (32 bytes pour AES-256)
    const kev = process.env.KEV;
    if (kev && (!/^[0-9a-f]+$/i.test(kev) || kev.length !== 64)) {
        errors.push('  ❌ KEV must be a 64-char hex string (32 bytes for AES-256)');
    }

    // KIV doit être une chaîne hex de 32 caractères (16 bytes pour AES IV)
    const kiv = process.env.KIV;
    if (kiv && (!/^[0-9a-f]+$/i.test(kiv) || kiv.length !== 32)) {
        errors.push('  ❌ KIV must be a 32-char hex string (16 bytes for AES IV)');
    }
}

/**
 * Valide la sécurité des clés
 */
function validateSecurityKeys(warnings) {
    const MIN_KEY_LENGTH = 32;

    // Vérifier la longueur des clés de sécurité (KEV et KIV sont validés par format hex dans validateFormats)
    const securityKeys = ['KEY_TK', 'SESSION_SECRET', 'CSRF_SECRET'];

    securityKeys.forEach((key) => {
        if (process.env[key] && process.env[key].length < MIN_KEY_LENGTH) {
            warnings.push(`  ⚠️  ${key} should be at least ${MIN_KEY_LENGTH} characters for security`);
        }
    });

    // Vérifier les valeurs par défaut non sécurisées
    const unsafeDefaults = [
        'your_secure_key_tk_here',
        'your_secure_encryption_key_here',
        'your_secure_initialization_vector_here',
        'your_secure_session_key_here',
        'your_secure_api_key_here',
        'your_password',
    ];

    securityKeys.forEach((key) => {
        if (process.env[key] && unsafeDefaults.includes(process.env[key])) {
            warnings.push(`  ⚠️  ${key} is using the default example value - CHANGE IT in production!`);
        }
    });

    // Avertissement production
    if (process.env.NODE_ENV === 'production') {
        if (process.env.DB_PWD === 'your_password') {
            warnings.push('  ⚠️  DB_PWD is using default value - CRITICAL in production!');
        }

        if (process.env.HELMET_STRICT_TRANSPORT !== 'true') {
            warnings.push('  ⚠️  HELMET_STRICT_TRANSPORT should be "true" in production (requires HTTPS)');
        }
    }
}

/**
 * Validations spécifiques à Docker
 */
function validateDockerConfig(warnings) {
    // Si DB_IP est localhost dans Docker, c'est probablement une erreur
    if (process.env.DB_IP === 'localhost' || process.env.DB_IP === '127.0.0.1') {
        warnings.push('  ⚠️  Running in Docker: DB_IP is set to localhost.' + '\n     Consider using the Docker service name (e.g., "db") instead.');
    }

    // Si ClamAV est activé et que le host est localhost dans Docker
    if (process.env.CLAMAV_ENABLED === 'true') {
        const clamHost = process.env.CLAMAV_HOST || '127.0.0.1';
        if (clamHost === 'localhost' || clamHost === '127.0.0.1') {
            warnings.push('  ⚠️  Running in Docker: CLAMAV_HOST is set to localhost.' + '\n     Consider using the Docker service name (e.g., "clamav") instead.');
        }
    }
}

/**
 * Vérifie l'état de la configuration SMTP et avertit si elle est incomplète.
 * Ne bloque pas le démarrage — la feature mail est simplement désactivée.
 */
function validateSmtpConfig() {
    const presentVars = SMTP_VARS.filter((key) => !!process.env[key]);
    const missingVars = SMTP_VARS.filter((key) => !process.env[key]);

    if (presentVars.length === 0) {
        // Aucune var SMTP définie : feature mail désactivée, pas d'avertissement intrusif
        console.log('📧 Mail feature disabled (no SMTP configuration found)\n');
        return;
    }

    if (missingVars.length > 0) {
        // Config partielle : avertir explicitement
        console.warn('⚠️  Incomplete SMTP configuration — mail feature is disabled');
        console.warn(`   Missing variables: ${missingVars.join(', ')}`);
        console.warn('   All SMTP_* vars must be set to enable password reset emails.\n');
        return;
    }

    console.log('📧 SMTP configuration found — mail feature enabled\n');
}

/**
 * Définit les valeurs par défaut pour les variables optionnelles
 */
export function setDefaults() {
    for (const [key, defaultValue] of Object.entries(OPTIONAL_VARS)) {
        if (!process.env[key]) {
            process.env[key] = defaultValue;
        }
    }
}
