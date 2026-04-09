/**
 * @file tests/unit/services/user.service.test.js
 * Unit tests for sendWelcomeEmail in user.service.js.
 * Database, mailer and mail helper are fully mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMail } from '../../../src/config/mailer.js';
import { renderMailTemplate } from '../../../src/helpers/mail.helpers.js';
import { sendWelcomeEmail } from '../../../src/services/user.service.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        User: { create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), update: vi.fn() },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/config/mailer.js', () => ({
    mailEnabled: true,
    sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/helpers/mail.helpers.js', () => ({
    renderMailTemplate: vi.fn().mockResolvedValue('<html>mock</html>'),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    hashPassword: vi.fn().mockResolvedValue('$2b$10$hashed'),
}));

vi.mock('../../../src/services/session.service.js', () => ({
    destroyUserSessions: vi.fn().mockResolvedValue(0),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('user.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    describe('sendWelcomeEmail()', () => {
        it('lève une erreur si mailEnabled est false', async () => {
            vi.doMock('../../../src/config/mailer.js', () => ({
                mailEnabled: false,
                sendMail: vi.fn(),
            }));
            const { sendWelcomeEmail: freshSend } = await import('../../../src/services/user.service.js?nomail');
            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await expect(freshSend(user)).rejects.toThrow('Mail service is not configured');
        });

        it("lève une erreur si l'utilisateur n'a pas d'email", async () => {
            const user = { login: 'jdupont', email: null };
            await expect(sendWelcomeEmail(user)).rejects.toThrow('User has no email address');
        });

        it('appelle renderMailTemplate avec le bon template et le bon contexte', async () => {
            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await sendWelcomeEmail(user);

            expect(renderMailTemplate).toHaveBeenCalledOnce();
            expect(renderMailTemplate).toHaveBeenCalledWith('welcome-user', {
                login: 'jdupont',
                firstLoginUrl: expect.stringContaining('/dp-first-connexion'),
            });
        });

        it('construit firstLoginUrl à partir de APP_URL', async () => {
            const originalAppUrl = process.env.APP_URL;
            process.env.APP_URL = 'https://puna.example.com';

            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await sendWelcomeEmail(user);

            expect(renderMailTemplate).toHaveBeenCalledWith('welcome-user', {
                login: 'jdupont',
                firstLoginUrl: 'https://puna.example.com/dp-first-connexion',
            });

            process.env.APP_URL = originalAppUrl;
        });

        it("utilise localhost:3000 par défaut si APP_URL n'est pas défini", async () => {
            const originalAppUrl = process.env.APP_URL;
            delete process.env.APP_URL;

            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await sendWelcomeEmail(user);

            expect(renderMailTemplate).toHaveBeenCalledWith('welcome-user', {
                login: 'jdupont',
                firstLoginUrl: 'http://localhost:3000/dp-first-connexion',
            });

            process.env.APP_URL = originalAppUrl;
        });

        it('appelle sendMail avec le bon destinataire et le bon sujet', async () => {
            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await sendWelcomeEmail(user);

            expect(sendMail).toHaveBeenCalledOnce();
            const callArgs = sendMail.mock.calls[0][0];
            expect(callArgs.to).toBe('jean.dupont@example.com');
            expect(callArgs.subject).toContain('Puna');
            expect(callArgs.html).toBe('<html>mock</html>');
        });

        it('attache le logo puna en CID dans le mail', async () => {
            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await sendWelcomeEmail(user);

            const { attachments } = sendMail.mock.calls[0][0];
            expect(attachments).toHaveLength(1);
            expect(attachments[0]).toMatchObject({
                filename: 'puna_logo.png',
                cid: 'puna_logo',
            });
            expect(attachments[0].path).toContain('puna_logo.png');
        });

        it("propage l'erreur si sendMail échoue", async () => {
            sendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

            const user = { login: 'jdupont', email: 'jean.dupont@example.com' };
            await expect(sendWelcomeEmail(user)).rejects.toThrow('SMTP connection refused');
        });
    });
});
