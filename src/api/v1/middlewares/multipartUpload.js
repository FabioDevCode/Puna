import fs from 'fs';
import path from 'path';
import multer from 'multer';

const TMP_DIR = process.env.UPLOADS_TMP || path.join(process.cwd(), 'storage', 'tmp');

// Limites configurables via variables d'environnement
const MAX_FILE_SIZE = parseInt(process.env.API_MAX_FILE_SIZE, 10) || 10 * 1024 * 1024; // 10 Mo par fichier
const MAX_TOTAL_SIZE = parseInt(process.env.API_MAX_TOTAL_SIZE, 10) || 50 * 1024 * 1024; // 50 Mo total
const MAX_FILES = parseInt(process.env.API_MAX_FILES, 10) || 10; // 10 fichiers max
const MAX_FIELDS = parseInt(process.env.API_MAX_FIELDS, 10) || 40; // 40 champs max
const MAX_FIELD_SIZE = parseInt(process.env.API_MAX_FIELD_SIZE, 10) || 10000; // 10000 caractères par champ

// Ensure temp dir exists
fs.mkdirSync(TMP_DIR, { recursive: true });

function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TMP_DIR);
    },
    filename: (req, file, cb) => {
        const ts = Date.now();
        const safe = sanitizeName(file.originalname || 'file');
        cb(null, `${ts}_${safe}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE, // Taille max par fichier (10 Mo)
        files: MAX_FILES, // Nombre max de fichiers (10)
        fields: MAX_FIELDS, // Nombre max de champs non-fichier (40)
        fieldSize: MAX_FIELD_SIZE, // Taille max par champ texte (10000 bytes)
    },
});

/**
 * Middleware de validation de la taille totale de la requête
 * Vérifie que la somme de tous les fichiers ne dépasse pas MAX_TOTAL_SIZE
 */
const validateTotalSize = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next();
    }

    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > MAX_TOTAL_SIZE) {
        // Supprimer les fichiers temporaires
        req.files.forEach((file) => {
            try {
                fs.unlinkSync(file.path);
            } catch {
                // Ignorer les erreurs de suppression
            }
        });

        return res.status(413).json({
            success: false,
            error: 'Payload too large',
            message: `La taille totale des fichiers (${Math.round(totalSize / 1024 / 1024)} Mo) dépasse la limite autorisée (${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)} Mo)`,
            maxTotalSize: MAX_TOTAL_SIZE,
        });
    }

    next();
};

/**
 * Middleware de validation de la taille des champs texte
 * Vérifie que chaque valeur dans req.body ne dépasse pas MAX_FIELD_SIZE caractères
 */
const validateFieldSizes = (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        return next();
    }

    const tooLongFields = [];

    for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string' && value.length > MAX_FIELD_SIZE) {
            tooLongFields.push({
                field: key,
                length: value.length,
                max: MAX_FIELD_SIZE,
            });
        }
    }

    if (tooLongFields.length > 0) {
        // Supprimer les fichiers temporaires si présents
        if (req.files && req.files.length > 0) {
            req.files.forEach((file) => {
                try {
                    fs.unlinkSync(file.path);
                } catch {
                    // Ignorer les erreurs de suppression
                }
            });
        }

        return res.status(413).json({
            success: false,
            error: 'Field value too large',
            message: `Un ou plusieurs champs dépassent la limite de ${MAX_FIELD_SIZE} caractères`,
            fields: tooLongFields,
        });
    }

    next();
};

/**
 * Middleware multer pour gérer les uploads multipart
 * Limites appliquées :
 * - MAX_FILE_SIZE: 10 Mo par fichier (configurable via API_MAX_FILE_SIZE)
 * - MAX_FILES: 10 fichiers max (configurable via API_MAX_FILES)
 * - MAX_FIELDS: 40 champs max (configurable via API_MAX_FIELDS)
 * - MAX_FIELD_SIZE: 10000 caractères par champ (configurable via API_MAX_FIELD_SIZE)
 * - MAX_TOTAL_SIZE: 50 Mo total (configurable via API_MAX_TOTAL_SIZE)
 */
export const multipartUpload = [upload.any(), validateTotalSize, validateFieldSizes];

export default multipartUpload;
