import fs from 'fs';
import CryptoJS from 'crypto-js';

let KEV;
let KIV;

if (process.env.KEV && process.env.KIV) {
    KEV = process.env.KEV;
    KIV = process.env.KIV;
} else {
    try {
        const keysUrl = new URL('../config/keys.json', import.meta.url);
        const raw = fs.readFileSync(keysUrl, 'utf8');
        const parsed = JSON.parse(raw);
        KEV = parsed.KEV;
        KIV = parsed.KIV;
    } catch (err) {
        throw new Error(
            'Encryption keys not found: please set process.env.KEV and process.env.KIV, or ensure src/config/keys.json exists and contains KEV/KIV.\n' +
				err.message
        );
    }
}

export function encryptObject(object) {
    const data = JSON.stringify(object);
    return Buffer.from(CryptoJS.AES.encrypt(data, KEV, { iv: KIV }).toString()).toString('Hex');
}

export function decryptObject(object) {
    const buffer = Buffer.from(object, 'Hex').toString();
    const bytes = CryptoJS.AES.decrypt(buffer, KEV, { iv: KIV });
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

export function encryptString(string) {
    return CryptoJS.AES.encrypt(string, KEV, { iv: KIV }).toString();
}

export function decryptString(string) {
    return CryptoJS.AES.decrypt(string, KEV, { iv: KIV }).toString(CryptoJS.enc.Utf8);
}
