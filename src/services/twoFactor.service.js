/**
 * Service 2FA (Two-Factor Authentication)
 * Gère la logique métier TOTP et les codes de récupération.
 * Fonctions pures exportées, pas d'accès à req/res.
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import models from '../models/index.js';
import { encryptString, decryptString, encryptObject, decryptObject } from '../utils/crypto.js';

/**
 * Génère un secret TOTP et le QR code pour l'enrôlement.
 * @param {string} login - Login de l'utilisateur
 * @returns {Promise<{ secret: string, qrCodeDataUrl: string, otpauthUrl: string }>}
 */
export async function generateTotpSetup(login) {
    const secret = new Secret();
    const totp = new TOTP({
        issuer: process.env.TOTP_ISSUER || 'Puna',
        label: login,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
    });
    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret: secret.base32, qrCodeDataUrl, otpauthUrl };
}

/**
 * Vérifie un code TOTP à 6 chiffres.
 * @param {string} encryptedSecret - Secret TOTP chiffré
 * @param {string} token - Code TOTP saisi par l'utilisateur
 * @returns {boolean}
 */
export function verifyTotpToken(encryptedSecret, token) {
    const decryptedSecret = decryptString(encryptedSecret);
    const totp = new TOTP({
        secret: Secret.fromBase32(decryptedSecret),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

/**
 * Génère 8 codes de récupération à usage unique (format xxxx-xxxx).
 * @returns {Promise<{ plainCodes: string[], hashedCodes: string[] }>}
 */
export async function generateBackupCodes() {
    const plainCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < 8; i++) {
        const hex = randomBytes(4).toString('hex');
        const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
        plainCodes.push(code);
        const hashed = await bcrypt.hash(code, 4);
        hashedCodes.push(hashed);
    }

    return { plainCodes, hashedCodes };
}

/**
 * Vérifie un code de récupération et le consomme (usage unique).
 * @param {string} encryptedCodes - Codes hachés chiffrés
 * @param {string} inputCode - Code saisi par l'utilisateur
 * @returns {Promise<{ valid: boolean, updatedEncryptedCodes?: string, remainingCount?: number }>}
 */
export async function verifyBackupCode(encryptedCodes, inputCode) {
    const codes = decryptObject(encryptedCodes);

    for (let i = 0; i < codes.length; i++) {
        const match = await bcrypt.compare(inputCode, codes[i]);
        if (match) {
            const remainingCodes = codes.filter((_, idx) => idx !== i);
            const updatedEncryptedCodes = encryptObject(remainingCodes);
            return { valid: true, updatedEncryptedCodes, remainingCount: remainingCodes.length };
        }
    }

    return { valid: false };
}

/**
 * Active la 2FA pour un utilisateur.
 * @param {number} userId - ID de l'utilisateur
 * @param {string} rawSecret - Secret TOTP en base32
 * @param {string[]} hashedCodes - Codes de récupération hachés
 * @returns {Promise<boolean>}
 */
export async function enableTotpForUser(userId, rawSecret, hashedCodes) {
    const totp_secret = encryptString(rawSecret);
    const totp_backup_codes = encryptObject(hashedCodes);
    const [updated] = await models.User.update({ totp_secret, totp_enabled: true, totp_backup_codes }, { where: { id: userId } });
    return updated > 0;
}

/**
 * Désactive la 2FA pour un utilisateur.
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<boolean>}
 */
export async function disableTotpForUser(userId) {
    const [updated] = await models.User.update({ totp_secret: null, totp_enabled: false, totp_backup_codes: null }, { where: { id: userId } });
    return updated > 0;
}

/**
 * Régénère les codes de récupération sans toucher au secret TOTP.
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<{ plainCodes: string[] }>}
 */
export async function regenerateBackupCodes(userId) {
    const { plainCodes, hashedCodes } = await generateBackupCodes();
    const encrypted = encryptObject(hashedCodes);
    await models.User.update({ totp_backup_codes: encrypted }, { where: { id: userId } });
    return { plainCodes };
}

/**
 * Retourne le statut 2FA d'un utilisateur.
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<{ enabled: boolean, backupCodesRemaining: number }>}
 */
export async function getTotpStatus(userId) {
    const user = await models.User.findByPk(userId, {
        attributes: ['totp_enabled', 'totp_backup_codes'],
    });

    if (!user) {
        return { enabled: false, backupCodesRemaining: 0 };
    }

    const { totp_enabled, totp_backup_codes } = user.toJSON();
    let backupCodesRemaining = 0;

    if (totp_enabled && totp_backup_codes) {
        const codes = decryptObject(totp_backup_codes);
        backupCodesRemaining = codes.length;
    }

    return { enabled: Boolean(totp_enabled), backupCodesRemaining };
}
