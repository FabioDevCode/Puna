#!/usr/bin/env node

/**
 * Puna — Interactive Environment Setup
 *
 * Generates a complete .env file through an interactive CLI.
 * Uses only native Node.js modules — can run before `npm install`.
 *
 * Usage: node scripts/setup.js
 */

import { randomBytes } from 'node:crypto';
import { existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env');
const ENV_BACKUP_PATH = resolve(PROJECT_ROOT, '.env.backup');

// ─── i18n ────────────────────────────────────────────────────────────────────

const messages = {
    fr: {
        langChoice: 'Langue / Language',
        docker: '🐳 Environnement Docker détecté — valeurs par défaut adaptées.',
        envFound: '⚠  Un fichier .env existant a été trouvé.',
        envOverwrite: 'Écraser et créer un .env.backup ?',
        envCancelled: "Installation annulée. Votre fichier .env n'a pas été modifié.",
        envBackupSaved: '✔ Sauvegarde enregistrée dans .env.backup',
        secKeysGenerated: '✔ Toutes les clés de sécurité ont été générées automatiquement.',
        defaultsInfo: '✔ Valeurs par défaut appliquées. Modifiez le .env pour personnaliser.',
        dialectInfo: '  DB_DIALECT=mariadb (seul dialecte supporté actuellement)',
        helmetInfo: '  HELMET_STRICT_TRANSPORT=false',
        logsRetention: '  Rétention : app=7j, api=14j, error=30j, audit=90j',
        logsConsole: '  LOG_TO_CONSOLE=true',
        rateInfo: '  Formulaire : 30 req / 60s | Connexion : 10 tentatives max',
        uploadInfo: '  Fichier : 10 Mo | Total : 50 Mo | Fichiers : 10 | Champs : 40',
        clamavEnable: 'Activer ClamAV (scan antivirus) ?',
        clamavSkipped: '  → Ignoré. Définissez CLAMAV_ENABLED=true dans .env pour activer plus tard.',
        clamavSocketHint: 'CLAMAV_SOCKET (laisser vide pour TCP)',
        clamavHostHint: 'CLAMAV_HOST (utilisé si socket est vide)',
        smtpEnable: 'Configurer SMTP pour les emails (réinitialisation mot de passe) ?',
        smtpSkipped: '  → Ignoré. Les fonctionnalités email seront désactivées.',
        smtpSkippedHint: '    Ajoutez les variables SMTP_* dans .env pour activer plus tard.',
        totpEnable: "Activer l'authentification à deux facteurs (TOTP) ?",
        totpSkipped: '  → Ignoré. Définissez TOTP_ENABLED=true dans .env pour activer plus tard.',
        adminLogin: 'Login administrateur',
        adminEmail: 'Email administrateur (optionnel)',
        successCreated: '✔ Fichier .env créé avec succès.',
        successStart: "  → Démarrer l'app : npm run dev (natif) ou docker compose up -d (Docker)",
        successAdmin: '  → Premier login : le compte admin est en statut « pending ».',
        successPassword: '    Définissez votre mot de passe sur /dp-first-connexion',
    },
    en: {
        langChoice: 'Langue / Language',
        docker: '🐳 Docker environment detected — defaults adjusted.',
        envFound: '⚠  An existing .env file was found.',
        envOverwrite: 'Overwrite and create .env.backup?',
        envCancelled: 'Setup cancelled. Your .env file was not modified.',
        envBackupSaved: '✔ Backup saved to .env.backup',
        secKeysGenerated: '✔ All security keys generated automatically.',
        defaultsInfo: '✔ Using defaults. Edit .env to customize.',
        dialectInfo: '  DB_DIALECT=mariadb (only supported dialect for now)',
        helmetInfo: '  HELMET_STRICT_TRANSPORT=false',
        logsRetention: '  Retention: app=7d, api=14d, error=30d, audit=90d',
        logsConsole: '  LOG_TO_CONSOLE=true',
        rateInfo: '  Form: 30 req / 60s | Login: 10 failed attempts max',
        uploadInfo: '  File: 10 MB | Total: 50 MB | Files: 10 | Fields: 40',
        clamavEnable: 'Enable ClamAV (antivirus scan)?',
        clamavSkipped: '  → Skipped. Set CLAMAV_ENABLED=true in .env to enable later.',
        clamavSocketHint: 'CLAMAV_SOCKET (leave empty for TCP)',
        clamavHostHint: 'CLAMAV_HOST (used if socket is empty)',
        smtpEnable: 'Configure SMTP for email features (password reset)?',
        smtpSkipped: '  → Skipped. Mail features (password reset) will be disabled.',
        smtpSkippedHint: '    Add SMTP_* variables to .env to enable later.',
        totpEnable: 'Enable two-factor authentication (TOTP)?',
        totpSkipped: '  → Skipped. Set TOTP_ENABLED=true in .env to enable later.',
        adminLogin: 'Admin login',
        adminEmail: 'Admin email (optional)',
        successCreated: '✔ .env file created successfully.',
        successStart: '  → Start the app: npm run dev (native) or docker compose up -d (Docker)',
        successAdmin: '  → First login: the admin account is in "pending" status.',
        successPassword: '    Set your password at /dp-first-connexion',
    },
};

let lang = 'fr';
const t = (key) => messages[lang][key] || key;

// ─── Input abstraction ──────────────────────────────────────────────────────

/**
 * Creates a prompt interface that works both in interactive TTY mode
 * and with piped/non-TTY input (for automation/CI).
 *
 * In TTY mode: uses readline with asterisk masking for passwords.
 * In pipe mode: pre-buffers all stdin lines, then distributes them
 * sequentially to each prompt call.
 */
async function createPrompt() {
    const isTTY = process.stdin.isTTY;

    if (isTTY) {
        // ── TTY (interactive) mode ──────────────────────────────────────
        const rl = createInterface({ input: process.stdin, output: process.stdout });

        return {
            ask(question, defaultValue = '') {
                const display = defaultValue ? ` [${defaultValue}]` : '';
                return new Promise((resolve) => {
                    rl.question(`? ${question}${display} : `, (answer) => {
                        resolve(answer.trim() || defaultValue);
                    });
                });
            },

            askPassword(question) {
                return new Promise((resolve) => {
                    rl.pause();
                    // Mute readline echo — prevents it from writing typed chars to stdout
                    const savedOutput = rl.output;
                    rl.output = null;

                    process.stdout.write(`? ${question} : `);

                    let password = '';
                    process.stdin.setRawMode(true);
                    process.stdin.resume();
                    process.stdin.setEncoding('utf8');

                    const onData = (ch) => {
                        const c = ch.toString();
                        if (c === '\u0003') {
                            process.stdout.write('\n');
                            process.exit(0);
                        }
                        if (c === '\r' || c === '\n') {
                            process.stdin.setRawMode(false);
                            process.stdin.removeListener('data', onData);
                            process.stdout.write('\n');
                            rl.output = savedOutput;
                            rl.resume();
                            resolve(password);
                            return;
                        }
                        if (c === '\u007F' || c === '\b') {
                            if (password.length > 0) {
                                password = password.slice(0, -1);
                                process.stdout.write('\b \b');
                            }
                            return;
                        }
                        password += c;
                        process.stdout.write('*');
                    };

                    process.stdin.on('data', onData);
                });
            },

            askYesNo(question, defaultNo = true) {
                const hint = defaultNo ? '(y/N)' : '(Y/n)';
                return new Promise((resolve) => {
                    rl.question(`? ${question} ${hint} : `, (answer) => {
                        const a = answer.trim().toLowerCase();
                        if (a === '') resolve(!defaultNo);
                        else resolve(a === 'y' || a === 'yes');
                    });
                });
            },

            close() {
                rl.close();
            },
        };
    }

    // ── Non-TTY (pipe) mode: pre-buffer all lines from stdin ────────────
    const lines = await new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data.split('\n'));
        });
    });

    let cursor = 0;
    const nextLine = () => (cursor < lines.length ? lines[cursor++].trim() : '');

    return {
        ask(question, defaultValue = '') {
            const display = defaultValue ? ` [${defaultValue}]` : '';
            const answer = nextLine();
            console.log(`? ${question}${display} : ${answer || defaultValue}`);
            return Promise.resolve(answer || defaultValue);
        },

        askPassword(question) {
            const answer = nextLine();
            console.log(`? ${question} : ${'*'.repeat(answer.length)}`);
            return Promise.resolve(answer);
        },

        askYesNo(question, defaultNo = true) {
            const hint = defaultNo ? '(y/N)' : '(Y/n)';
            const answer = nextLine().toLowerCase();
            const result = answer === '' ? !defaultNo : answer === 'y' || answer === 'yes';
            console.log(`? ${question} ${hint} : ${answer || (defaultNo ? 'N' : 'Y')}`);
            return Promise.resolve(result);
        },

        close() {
            // no-op
        },
    };
}

function isDocker() {
    try {
        return existsSync('/.dockerenv');
    } catch {
        return false;
    }
}

function sectionHeader(num, total, title) {
    console.log(`\n── ${num}/${total} ${title} ${'─'.repeat(Math.max(0, 40 - title.length))}`);
}

function generateKey(bytes, encoding = 'base64url') {
    return randomBytes(bytes).toString(encoding);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const TOTAL_SECTIONS = 11;
    const dockerEnv = isDocker();

    // ── Banner ──────────────────────────────────────────────────────────────
    console.log('');
    console.log(`
             xddddd
         ddddddddddd ccccc
       ddddddddddddd cccccc ''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
       ddddddddddddd cccccc '''''
        dddddddddddd cccccc ''''
           kdddddddd cccc
               dddd
    `);
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║     Puna — Environment Setup         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    // ── Language selection ───────────────────────────────────────────────────

    const prompt = await createPrompt();

    const langChoice = await prompt.ask('Langue / Language (fr/en)', 'fr');
    lang = langChoice.toLowerCase() === 'en' ? 'en' : 'fr';

    if (dockerEnv) {
        console.log(`${t('docker')}\n`);
    }

    if (existsSync(ENV_PATH)) {
        console.log(t('envFound'));
        const overwrite = await prompt.askYesNo(t('envOverwrite'), true);
        if (!overwrite) {
            console.log(`\n${t('envCancelled')}`);
            prompt.close();
            process.exit(0);
        }
        copyFileSync(ENV_PATH, ENV_BACKUP_PATH);
        console.log(`${t('envBackupSaved')}\n`);
    }

    // ── Collect values ──────────────────────────────────────────────────────

    const env = {};

    // — Section 1: Application ———————————————————————————————————————————————

    sectionHeader(1, TOTAL_SECTIONS, 'Application');
    env.NODE_ENV = await prompt.ask('NODE_ENV', 'development');
    env.PORT = await prompt.ask('PORT', '3022');

    // — Section 2: Database ——————————————————————————————————————————————————

    sectionHeader(2, TOTAL_SECTIONS, 'Database');
    env.DB_IP = await prompt.ask('DB_IP', dockerEnv ? 'db' : '127.0.0.1');
    env.DB_PORT = await prompt.ask('DB_PORT', '3306');
    env.DB_USER = await prompt.ask('DB_USER', 'root');
    env.DB_PWD = await prompt.askPassword('DB_PWD');
    env.DB_NAME = await prompt.ask('DB_NAME', 'puna');
    env.DB_DIALECT = 'mariadb';
    console.log(t('dialectInfo'));

    // — Section 3: Security Keys (auto) ——————————————————————————————————————

    sectionHeader(3, TOTAL_SECTIONS, 'Security Keys');
    env.KEY_TK = generateKey(48, 'base64url');
    env.KEV = generateKey(32, 'hex');
    env.KIV = generateKey(16, 'hex');
    env.SESSION_SECRET = generateKey(48, 'base64url');
    env.SESSION_MAX_AGE = '10800000';
    env.CSRF_SECRET = generateKey(48, 'base64url');
    env.API_KEY = generateKey(32, 'hex');

    console.log(t('secKeysGenerated'));
    console.log(`  KEY_TK .......... ${env.KEY_TK.length} chars`);
    console.log(`  KEV ............. ${env.KEV.length} hex chars (32 bytes AES-256)`);
    console.log(`  KIV ............. ${env.KIV.length} hex chars (16 bytes AES IV)`);
    console.log(`  SESSION_SECRET .. ${env.SESSION_SECRET.length} chars`);
    console.log(`  CSRF_SECRET ..... ${env.CSRF_SECRET.length} chars`);
    console.log(`  API_KEY ......... ${env.API_KEY.length} hex chars`);

    // — Sections 4–7: Defaults (Helmet, Logs, Rate Limiting, Upload) —————————

    sectionHeader(4, TOTAL_SECTIONS, 'Helmet');
    env.HELMET_STRICT_TRANSPORT = 'false';
    console.log(t('defaultsInfo'));
    console.log(t('helmetInfo'));

    sectionHeader(5, TOTAL_SECTIONS, 'Logs');
    env.LOG_RETENTION_APP = '7';
    env.LOG_RETENTION_API = '14';
    env.LOG_RETENTION_ERROR = '30';
    env.LOG_RETENTION_AUDIT = '90';
    env.LOG_TO_CONSOLE = 'true';
    console.log(t('defaultsInfo'));
    console.log(t('logsRetention'));
    console.log(t('logsConsole'));

    sectionHeader(6, TOTAL_SECTIONS, 'Rate Limiting');
    env.RATE_LIMIT_FORM_MAX = '30';
    env.RATE_LIMIT_FORM_WINDOW_MS = '60000';
    env.MAX_FAILED_LOGIN_ATTEMPTS = '10';
    console.log(t('defaultsInfo'));
    console.log(t('rateInfo'));

    sectionHeader(7, TOTAL_SECTIONS, 'Upload Limits');
    env.API_MAX_FILE_SIZE = '10485760';
    env.API_MAX_TOTAL_SIZE = '52428800';
    env.API_MAX_FILES = '10';
    env.API_MAX_FIELDS = '40';
    env.API_MAX_FIELD_SIZE = '10000';
    console.log(t('defaultsInfo'));
    console.log(t('uploadInfo'));

    // — Section 8: ClamAV (optional) —————————————————————————————————————————

    sectionHeader(8, TOTAL_SECTIONS, 'ClamAV');
    const enableClamav = await prompt.askYesNo(t('clamavEnable'), true);
    if (enableClamav) {
        env.CLAMAV_ENABLED = 'true';
        if (dockerEnv) {
            env.CLAMAV_SOCKET = await prompt.ask(t('clamavSocketHint'), '');
            env.CLAMAV_HOST = await prompt.ask('CLAMAV_HOST', 'clamav');
            env.CLAMAV_PORT = await prompt.ask('CLAMAV_PORT', '3310');
        } else {
            env.CLAMAV_SOCKET = await prompt.ask('CLAMAV_SOCKET', '/tmp/clamd.socket');
            env.CLAMAV_HOST = await prompt.ask(t('clamavHostHint'), '127.0.0.1');
            env.CLAMAV_PORT = await prompt.ask('CLAMAV_PORT', '3310');
        }
    } else {
        env.CLAMAV_ENABLED = 'false';
        env.CLAMAV_SOCKET = '';
        env.CLAMAV_HOST = '';
        env.CLAMAV_PORT = '3310';
        console.log(t('clamavSkipped'));
    }

    // — Section 9: SMTP (optional) ———————————————————————————————————————————

    sectionHeader(9, TOTAL_SECTIONS, 'SMTP');
    const enableSmtp = await prompt.askYesNo(t('smtpEnable'), true);
    if (enableSmtp) {
        env.SMTP_HOST = await prompt.ask('SMTP_HOST', 'smtp.example.com');
        env.SMTP_PORT = await prompt.ask('SMTP_PORT', '587');
        env.SMTP_USER = await prompt.ask('SMTP_USER');
        env.SMTP_PASS = await prompt.askPassword('SMTP_PASS');
        env.SMTP_FROM = await prompt.ask('SMTP_FROM', `Puna <${env.SMTP_USER || 'no-reply@example.com'}>`);
        env.APP_URL = await prompt.ask('APP_URL', `http://localhost:${env.PORT}`);
    } else {
        console.log(t('smtpSkipped'));
        console.log(t('smtpSkippedHint'));
    }

    // — Section 10: TOTP (optional) ——————————————————————————————————————————

    sectionHeader(10, TOTAL_SECTIONS, 'TOTP (2FA)');
    const enableTotp = await prompt.askYesNo(t('totpEnable'), true);
    if (enableTotp) {
        env.TOTP_ENABLED = 'true';
        env.TOTP_ISSUER = await prompt.ask('TOTP_ISSUER', 'Puna');
    } else {
        env.TOTP_ENABLED = 'false';
        env.TOTP_ISSUER = 'Puna';
        console.log(t('totpSkipped'));
    }

    // — Section 11: Admin ————————————————————————————————————————————————————

    sectionHeader(11, TOTAL_SECTIONS, 'Admin');
    env.ADMIN_LOGIN = await prompt.ask(t('adminLogin'), 'admin');
    env.ADMIN_EMAIL = await prompt.ask(t('adminEmail'), '');

    prompt.close();

    // ── Generate .env file ──────────────────────────────────────────────────

    const content = buildEnvContent(env);
    writeFileSync(ENV_PATH, content, 'utf8');

    console.log(`\n${t('successCreated')}`);
    console.log(t('successStart'));
    console.log(t('successAdmin'));
    console.log(`${t('successPassword')}\n`);
}

// ─── .env file builder ──────────────────────────────────────────────────────

function buildEnvContent(env) {
    const lines = [];

    const ln = (text = '') => lines.push(text);
    const val = (key) => {
        const v = env[key];
        if (v === undefined) return;
        // Quote values that contain spaces or special chars
        const needsQuotes = /[\s#"']/.test(v) || v === '';
        lines.push(`${key}=${needsQuotes ? `"${v}"` : v}`);
    };

    ln('# Application');
    val('NODE_ENV');
    val('PORT');
    ln();

    ln('# Helmet');
    val('HELMET_STRICT_TRANSPORT');
    ln();

    ln('# Database');
    val('DB_IP');
    val('DB_PORT');
    val('DB_USER');
    val('DB_PWD');
    val('DB_NAME');
    val('DB_DIALECT');
    ln();

    ln('# Security Keys (auto-generated)');
    val('KEY_TK');
    val('KEV');
    val('KIV');
    ln();

    ln('# Session');
    val('SESSION_SECRET');
    val('SESSION_MAX_AGE');
    ln();

    ln('# CSRF');
    val('CSRF_SECRET');
    ln();

    ln('# API Key');
    val('API_KEY');
    ln();

    ln('# Logs — retention in days');
    val('LOG_RETENTION_APP');
    val('LOG_RETENTION_API');
    val('LOG_RETENTION_ERROR');
    val('LOG_RETENTION_AUDIT');
    val('LOG_TO_CONSOLE');
    ln();

    ln('# Rate Limiting');
    val('RATE_LIMIT_FORM_MAX');
    val('RATE_LIMIT_FORM_WINDOW_MS');
    val('MAX_FAILED_LOGIN_ATTEMPTS');
    ln();

    ln('# Upload Limits');
    val('API_MAX_FILE_SIZE');
    val('API_MAX_TOTAL_SIZE');
    val('API_MAX_FILES');
    val('API_MAX_FIELDS');
    val('API_MAX_FIELD_SIZE');
    ln();

    ln('# ClamAV');
    val('CLAMAV_ENABLED');
    if (env.CLAMAV_ENABLED === 'true') {
        val('CLAMAV_SOCKET');
        val('CLAMAV_HOST');
        val('CLAMAV_PORT');
    }
    ln();

    if (env.SMTP_HOST) {
        ln('# SMTP');
        val('SMTP_HOST');
        val('SMTP_PORT');
        val('SMTP_USER');
        val('SMTP_PASS');
        val('SMTP_FROM');
        ln();
        val('APP_URL');
        ln();
    }

    ln('# TOTP (2FA)');
    val('TOTP_ENABLED');
    val('TOTP_ISSUER');
    ln();

    ln('# Admin');
    val('ADMIN_LOGIN');
    val('ADMIN_EMAIL');
    ln();

    return lines.join('\n');
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
});
