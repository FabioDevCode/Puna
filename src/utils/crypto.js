import { createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';

// KEV doit être une clé de 32 bytes (hex = 64 chars)
// KIV doit être un IV de 16 bytes (hex = 32 chars)
const KEY = Buffer.from(process.env.KEV || '', 'hex');
const IV = Buffer.from(process.env.KIV || '', 'hex');

if (KEY.length !== 32) {
    throw new Error('KEV must be a 64-char hex string (32 bytes for AES-256)');
}
if (IV.length !== 16) {
    throw new Error('KIV must be a 32-char hex string (16 bytes for AES IV)');
}

export function encryptObject(object) {
    const data = JSON.stringify(object);
    const cipher = createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decryptObject(encryptedHex) {
    const decipher = createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

export function encryptString(string) {
    const cipher = createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(string, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decryptString(encryptedHex) {
    const decipher = createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
