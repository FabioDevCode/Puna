import CryptoJS from 'crypto-js';

const KEV = process.env.KEV;
const KIV = process.env.KIV;

if (!KEV || !KIV) {
    throw new Error(
        'Encryption keys not found: please set KEV and KIV environment variables in .env file'
    );
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
