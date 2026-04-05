import nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isMailConfigured } from '../../../src/config/env.validator.js';
import { logger as appLogger } from '../../../src/config/logger.js';

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(),
    },
}));

vi.mock('../../../src/config/env.validator.js', () => ({
    isMailConfigured: vi.fn(),
}));

vi.mock('../../../src/config/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('mailer config', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    describe('when SMTP is not configured', () => {
        beforeEach(() => {
            isMailConfigured.mockReturnValue(false);
        });

        it('exports mailEnabled as false', async () => {
            const { mailEnabled } = await import('../../../src/config/mailer.js');
            expect(mailEnabled).toBe(false);
        });

        it('sendMail throws an error with clear message', async () => {
            const { sendMail } = await import('../../../src/config/mailer.js');
            await expect(sendMail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })).rejects.toThrow('Mail service is not configured');
        });

        it('does not call nodemailer.createTransport', async () => {
            await import('../../../src/config/mailer.js');
            expect(nodemailer.createTransport).not.toHaveBeenCalled();
        });

        it('verifyMailTransport returns without doing anything', async () => {
            const { verifyMailTransport } = await import('../../../src/config/mailer.js');
            await expect(verifyMailTransport()).resolves.toBeUndefined();
        });
    });

    describe('when SMTP is configured', () => {
        const mockVerify = vi.fn();
        const mockSendMail = vi.fn();
        const mockTransporter = { verify: mockVerify, sendMail: mockSendMail };

        beforeEach(() => {
            isMailConfigured.mockReturnValue(true);
            nodemailer.createTransport.mockReturnValue(mockTransporter);
            process.env.SMTP_HOST = 'smtp.example.com';
            process.env.SMTP_PORT = '587';
            process.env.SMTP_USER = 'user@example.com';
            process.env.SMTP_PASS = 'secret';
            process.env.SMTP_FROM = 'noreply@example.com';
        });

        it('exports mailEnabled as true', async () => {
            const { mailEnabled } = await import('../../../src/config/mailer.js');
            expect(mailEnabled).toBe(true);
        });

        it('creates transporter with correct config', async () => {
            await import('../../../src/config/mailer.js');
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.example.com',
                port: 587,
                secure: false,
                auth: {
                    user: 'user@example.com',
                    pass: 'secret',
                },
            });
        });

        it('creates transporter with secure=true for port 465', async () => {
            process.env.SMTP_PORT = '465';
            await import('../../../src/config/mailer.js');
            expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
        });

        describe('sendMail()', () => {
            it('sends mail and logs success', async () => {
                mockSendMail.mockResolvedValue({ messageId: 'msg-123' });
                const { sendMail } = await import('../../../src/config/mailer.js');
                await sendMail({ to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' });
                expect(mockSendMail).toHaveBeenCalledWith({
                    from: 'noreply@example.com',
                    to: 'user@example.com',
                    subject: 'Test',
                    html: '<p>Test</p>',
                    attachments: [],
                });
                expect(appLogger.info).toHaveBeenCalledWith({ to: 'user@example.com', messageId: 'msg-123' }, 'Email sent successfully');
            });

            it('logs error and re-throws on failure', async () => {
                const error = new Error('SMTP connection failed');
                mockSendMail.mockRejectedValue(error);
                const { sendMail } = await import('../../../src/config/mailer.js');
                await expect(sendMail({ to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' })).rejects.toThrow('SMTP connection failed');
                expect(appLogger.error).toHaveBeenCalledWith({ err: error, to: 'user@example.com' }, 'Failed to send email');
            });
        });

        describe('verifyMailTransport()', () => {
            it('logs success when verify resolves', async () => {
                mockVerify.mockResolvedValue(true);
                const { verifyMailTransport } = await import('../../../src/config/mailer.js');
                await verifyMailTransport();
                expect(appLogger.info).toHaveBeenCalledWith('SMTP transport verified successfully');
            });

            it('logs a warning when verify fails, does not throw', async () => {
                mockVerify.mockRejectedValue(new Error('Connection refused'));
                const { verifyMailTransport } = await import('../../../src/config/mailer.js');
                await expect(verifyMailTransport()).resolves.toBeUndefined();
                expect(appLogger.warn).toHaveBeenCalledWith('SMTP transport verification failed: Connection refused');
            });
        });
    });
});
