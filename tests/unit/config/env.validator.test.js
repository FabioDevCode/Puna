/**
 * @file tests/unit/config/env.validator.test.js
 * Unit tests for src/config/env.validator.js.
 * node:fs and node:net are fully mocked so that no real I/O is performed.
 */

import fs from 'node:fs';
import net from 'node:net';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMailConfigured, isTotpEnabled, setDefaults, validateEnv } from '../../../src/config/env.validator.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
    },
}));

vi.mock('node:net', () => ({
    default: {
        createConnection: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid environment that passes every validation.
 * KEV  = 64 hex chars (32 bytes AES-256)
 * KIV  = 32 hex chars (16 bytes AES IV)
 * Security keys are 32 chars long (at the MIN_KEY_LENGTH boundary).
 */
const VALID_ENV = {
    DB_IP: '127.0.0.1',
    DB_PORT: '3306',
    DB_USER: 'root',
    DB_PWD: 'strongpassword',
    DB_NAME: 'testdb',
    DB_DIALECT: 'mysql',
    KEY_TK: 'a'.repeat(32),
    KEV: 'a'.repeat(64),
    KIV: 'b'.repeat(32),
    SESSION_SECRET: 'c'.repeat(32),
    CSRF_SECRET: 'd'.repeat(32),
    API_KEY: 'e'.repeat(32),
    PORT: '3000',
    NODE_ENV: 'test',
};

/**
 * Creates a mock net.Socket that responds with PONG.
 * After all `once` listeners are registered, the 'connect' event fires,
 * which causes `write('PING\n')` to be called, which in turn triggers
 * the 'data' event with the string 'PONG'.
 */
function createPongSocket() {
    const handlers = {};
    const socket = {
        once: vi.fn((event, fn) => {
            handlers[event] = fn;
        }),
        write: vi.fn(() => {
            setImmediate(() => {
                if (handlers.data) handlers.data(Buffer.from('PONG'));
            });
        }),
        destroy: vi.fn(),
    };
    setImmediate(() => {
        if (handlers.connect) handlers.connect();
    });
    return socket;
}

/**
 * Creates a mock net.Socket that immediately emits an 'error' event.
 */
function createErrorSocket() {
    const handlers = {};
    const socket = {
        once: vi.fn((event, fn) => {
            handlers[event] = fn;
        }),
        write: vi.fn(),
        destroy: vi.fn(),
    };
    setImmediate(() => {
        if (handlers.error) handlers.error(new Error('ECONNREFUSED'));
    });
    return socket;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('env.validator', () => {
    const originalEnv = process.env;
    let exitSpy;

    beforeEach(() => {
        process.env = { ...VALID_ENV };
        // Make process.exit throw so we can assert on it without stopping the process.
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Default: not running in Docker
        vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    // -----------------------------------------------------------------------
    describe('isTotpEnabled()', () => {
        it('returns true when TOTP_ENABLED=true', () => {
            process.env.TOTP_ENABLED = 'true';
            expect(isTotpEnabled()).toBe(true);
        });

        it('returns false when TOTP_ENABLED=false', () => {
            process.env.TOTP_ENABLED = 'false';
            expect(isTotpEnabled()).toBe(false);
        });

        it('returns false when TOTP_ENABLED is absent', () => {
            delete process.env.TOTP_ENABLED;
            expect(isTotpEnabled()).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    describe('isMailConfigured()', () => {
        const SMTP_VARS = {
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '587',
            SMTP_USER: 'user@example.com',
            SMTP_PASS: 'secret',
            SMTP_FROM: 'noreply@example.com',
        };

        it('returns true when all SMTP vars are present', () => {
            Object.assign(process.env, SMTP_VARS);
            expect(isMailConfigured()).toBe(true);
        });

        it('returns false when one SMTP var is missing', () => {
            Object.assign(process.env, SMTP_VARS);
            delete process.env.SMTP_PASS;
            expect(isMailConfigured()).toBe(false);
        });

        it('returns false when no SMTP vars are present', () => {
            for (const key of Object.keys(SMTP_VARS)) {
                delete process.env[key];
            }
            expect(isMailConfigured()).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    describe('setDefaults()', () => {
        it('sets SESSION_MAX_AGE to its default when absent', () => {
            delete process.env.SESSION_MAX_AGE;
            setDefaults();
            expect(process.env.SESSION_MAX_AGE).toBe('43200000');
        });

        it('sets TOTP_ENABLED to "false" when absent', () => {
            delete process.env.TOTP_ENABLED;
            setDefaults();
            expect(process.env.TOTP_ENABLED).toBe('false');
        });

        it('sets HELMET_STRICT_TRANSPORT to "false" when absent', () => {
            delete process.env.HELMET_STRICT_TRANSPORT;
            setDefaults();
            expect(process.env.HELMET_STRICT_TRANSPORT).toBe('false');
        });

        it('sets APP_URL to its default when absent', () => {
            delete process.env.APP_URL;
            setDefaults();
            expect(process.env.APP_URL).toBe('http://localhost:3000');
        });

        it('does not overwrite an already present optional var', () => {
            process.env.SESSION_MAX_AGE = '99999';
            setDefaults();
            expect(process.env.SESSION_MAX_AGE).toBe('99999');
        });

        it('sets TOTP_ISSUER to "Puna" when absent', () => {
            delete process.env.TOTP_ISSUER;
            setDefaults();
            expect(process.env.TOTP_ISSUER).toBe('Puna');
        });
    });

    // -----------------------------------------------------------------------
    describe('validateEnv()', () => {
        // -------------------------------------------------------------------
        describe('valid configuration', () => {
            it('resolves successfully without calling process.exit', async () => {
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('missing required variables', () => {
            const requiredVars = [
                'DB_IP',
                'DB_PORT',
                'DB_USER',
                'DB_PWD',
                'DB_NAME',
                'DB_DIALECT',
                'KEY_TK',
                'KEV',
                'KIV',
                'SESSION_SECRET',
                'CSRF_SECRET',
                'API_KEY',
                'PORT',
                'NODE_ENV',
            ];

            for (const varName of requiredVars) {
                it(`exits when ${varName} is missing`, async () => {
                    delete process.env[varName];
                    await expect(validateEnv()).rejects.toThrow();
                    expect(exitSpy).toHaveBeenCalledWith(1);
                });
            }
        });

        // -------------------------------------------------------------------
        describe('PORT validation', () => {
            it('exits when PORT is 0', async () => {
                process.env.PORT = '0';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when PORT is above 65535', async () => {
                process.env.PORT = '99999';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when PORT is not a number', async () => {
                process.env.PORT = 'abc';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });
        });

        // -------------------------------------------------------------------
        describe('DB_PORT validation', () => {
            it('exits when DB_PORT is 0', async () => {
                process.env.DB_PORT = '0';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when DB_PORT is not a number', async () => {
                process.env.DB_PORT = 'abc';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });
        });

        // -------------------------------------------------------------------
        describe('NODE_ENV validation', () => {
            it('exits when NODE_ENV is an invalid value', async () => {
                process.env.NODE_ENV = 'staging';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts "development" as a valid NODE_ENV', async () => {
                process.env.NODE_ENV = 'development';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('accepts "production" as a valid NODE_ENV', async () => {
                process.env.NODE_ENV = 'production';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('DB_DIALECT validation', () => {
            it('exits when DB_DIALECT is invalid', async () => {
                process.env.DB_DIALECT = 'oracle';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts "mariadb" as a valid DB_DIALECT', async () => {
                process.env.DB_DIALECT = 'mariadb';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('accepts "postgres" as a valid DB_DIALECT', async () => {
                process.env.DB_DIALECT = 'postgres';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('KEV / KIV format validation', () => {
            it('exits when KEV is shorter than 64 chars', async () => {
                process.env.KEV = 'a'.repeat(32);
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when KEV contains non-hex characters', async () => {
                process.env.KEV = 'z'.repeat(64);
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when KIV is shorter than 32 chars', async () => {
                process.env.KIV = 'a'.repeat(16);
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when KIV contains non-hex characters', async () => {
                process.env.KIV = 'z'.repeat(32);
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });
        });

        // -------------------------------------------------------------------
        describe('SESSION_MAX_AGE validation', () => {
            it('exits when SESSION_MAX_AGE is not a number', async () => {
                process.env.SESSION_MAX_AGE = 'not-a-number';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts a numeric SESSION_MAX_AGE', async () => {
                process.env.SESSION_MAX_AGE = '3600000';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('HELMET_STRICT_TRANSPORT validation', () => {
            it('exits when HELMET_STRICT_TRANSPORT is not "true" or "false"', async () => {
                process.env.HELMET_STRICT_TRANSPORT = 'maybe';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts HELMET_STRICT_TRANSPORT="true"', async () => {
                process.env.HELMET_STRICT_TRANSPORT = 'true';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('accepts HELMET_STRICT_TRANSPORT="false"', async () => {
                process.env.HELMET_STRICT_TRANSPORT = 'false';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('SMTP_PORT validation', () => {
            it('exits when SMTP_PORT is above 65535', async () => {
                process.env.SMTP_PORT = '99999';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when SMTP_PORT is 0', async () => {
                process.env.SMTP_PORT = '0';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts a valid SMTP_PORT', async () => {
                process.env.SMTP_PORT = '587';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('CLAMAV validation', () => {
            it('exits when CLAMAV_ENABLED has an invalid value', async () => {
                process.env.CLAMAV_ENABLED = 'yes';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when CLAMAV_ENABLED=true but no socket or host is configured', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when CLAMAV_PORT is above 65535', async () => {
                process.env.CLAMAV_PORT = '99999';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when CLAMAV_PORT is 0', async () => {
                process.env.CLAMAV_PORT = '0';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when CLAMAV_SOCKET is a relative path', async () => {
                process.env.CLAMAV_SOCKET = 'relative/path/clamd.socket';
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('accepts a valid CLAMAV_PORT', async () => {
                process.env.CLAMAV_PORT = '3310';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('accepts an absolute CLAMAV_SOCKET path (not enabled)', async () => {
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('security key warnings (non-blocking)', () => {
            it('warns but does not exit when KEY_TK is shorter than 32 chars', async () => {
                process.env.KEY_TK = 'short';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns but does not exit when SESSION_SECRET is shorter than 32 chars', async () => {
                process.env.SESSION_SECRET = 'short';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns but does not exit when CSRF_SECRET is shorter than 32 chars', async () => {
                process.env.CSRF_SECRET = 'short';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns when KEY_TK uses an example default value', async () => {
                process.env.KEY_TK = 'your_secure_key_tk_here';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns when SESSION_SECRET uses an example default value', async () => {
                process.env.SESSION_SECRET = 'your_secure_session_key_here';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns in production when DB_PWD uses the default value', async () => {
                process.env.NODE_ENV = 'production';
                process.env.DB_PWD = 'your_password';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns in production when HELMET_STRICT_TRANSPORT is not "true"', async () => {
                process.env.NODE_ENV = 'production';
                process.env.HELMET_STRICT_TRANSPORT = 'false';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('Docker-specific warnings (non-blocking)', () => {
            beforeEach(() => {
                // Simulate running inside a Docker container
                vi.mocked(fs.existsSync).mockReturnValue(true);
            });

            it('warns when DB_IP is "localhost" inside Docker', async () => {
                process.env.DB_IP = 'localhost';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns when DB_IP is "127.0.0.1" inside Docker', async () => {
                process.env.DB_IP = '127.0.0.1';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });

            it('warns when CLAMAV_HOST is localhost inside Docker', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                process.env.CLAMAV_HOST = 'localhost';
                net.createConnection.mockImplementation(() => createPongSocket());
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalled();
            });
        });

        // -------------------------------------------------------------------
        describe('SMTP configuration (non-blocking)', () => {
            const SMTP_VARS = {
                SMTP_HOST: 'smtp.example.com',
                SMTP_PORT: '587',
                SMTP_USER: 'user@example.com',
                SMTP_PASS: 'secret',
                SMTP_FROM: 'noreply@example.com',
            };

            it('logs "mail disabled" when no SMTP vars are set', async () => {
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Mail feature disabled'));
            });

            it('warns about incomplete SMTP config when only some vars are set', async () => {
                process.env.SMTP_HOST = 'smtp.example.com';
                process.env.SMTP_PORT = '587';
                // SMTP_USER, SMTP_PASS, SMTP_FROM are missing
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Incomplete SMTP'));
            });

            it('logs "mail feature enabled" when all SMTP vars are set', async () => {
                Object.assign(process.env, SMTP_VARS);
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(console.log).toHaveBeenCalledWith(expect.stringContaining('mail feature enabled'));
            });
        });

        // -------------------------------------------------------------------
        describe('ClamAV connectivity check', () => {
            it('resolves when CLAMAV_ENABLED=true and socket responds with PONG', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                net.createConnection.mockImplementation(() => createPongSocket());
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('resolves when CLAMAV_ENABLED=true and TCP host responds with PONG', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_HOST = 'clamav';
                process.env.CLAMAV_PORT = '3310';
                net.createConnection.mockImplementation(() => createPongSocket());
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('exits when CLAMAV_ENABLED=true and the socket does not respond', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                net.createConnection.mockImplementation(() => createErrorSocket());
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('exits when CLAMAV_ENABLED=true and TCP host does not respond', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_HOST = 'clamav';
                process.env.CLAMAV_PORT = '3310';
                net.createConnection.mockImplementation(() => createErrorSocket());
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('succeeds when both socket and host are configured and at least one responds with PONG', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                process.env.CLAMAV_HOST = 'clamav';
                process.env.CLAMAV_PORT = '3310';
                // socket fails, host succeeds
                net.createConnection.mockImplementationOnce(() => createErrorSocket()).mockImplementationOnce(() => createPongSocket());
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
            });

            it('exits when both socket and host are configured and both fail', async () => {
                process.env.CLAMAV_ENABLED = 'true';
                process.env.CLAMAV_SOCKET = '/tmp/clamd.socket';
                process.env.CLAMAV_HOST = 'clamav';
                process.env.CLAMAV_PORT = '3310';
                net.createConnection.mockImplementation(() => createErrorSocket());
                await expect(validateEnv()).rejects.toThrow();
                expect(exitSpy).toHaveBeenCalledWith(1);
            });

            it('does not ping ClamAV when CLAMAV_ENABLED=false', async () => {
                process.env.CLAMAV_ENABLED = 'false';
                await validateEnv();
                expect(exitSpy).not.toHaveBeenCalled();
                expect(net.createConnection).not.toHaveBeenCalled();
            });
        });
    });
});
