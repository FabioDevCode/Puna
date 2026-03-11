import nodemailer from 'nodemailer';
import { isMailConfigured } from './env.validator.js';
import { logger as appLogger } from './logger.js';

/**
 * Indicates whether the mail feature is enabled (all SMTP env vars are set).
 * @type {boolean}
 */
export const mailEnabled = isMailConfigured();

let transporter;

if (mailEnabled) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Sends an email using the configured SMTP transporter.
 * @param {Object} options - Mail options.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject.
 * @param {string} options.html - HTML body of the email.
 * @returns {Promise<void>}
 * @throws {Error} If the mail service is not configured.
 */
export async function sendMail({ to, subject, html }) {
    if (!mailEnabled) {
        throw new Error('Mail service is not configured');
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            html,
        });
        appLogger.info({ to, messageId: info.messageId }, 'Email sent successfully');
    } catch (err) {
        appLogger.error({ err, to }, 'Failed to send email');
        throw err;
    }
}

/**
 * Verifies the SMTP transporter connection.
 * Does nothing if mail is not configured.
 * Logs a warning on failure without throwing, to avoid crashing the app.
 * @returns {Promise<void>}
 */
export async function verifyMailTransport() {
    if (!mailEnabled) {
        return;
    }

    try {
        await transporter.verify();
        appLogger.info('SMTP transport verified successfully');
    } catch (err) {
        appLogger.warn(`SMTP transport verification failed: ${err.message}`);
    }
}
