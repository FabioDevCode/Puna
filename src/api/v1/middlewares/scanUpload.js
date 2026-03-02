/**
 * ================================================================
 * MIDDLEWARE — Scan antivirus ClamAV (optionnel)
 * ================================================================
 * Scanne les fichiers uploadés via le daemon ClamAV (clamd).
 * Activé uniquement si CLAMAV_ENABLED=true dans .env.
 *
 * Modes de connexion (auto-détecté) :
 *   - Socket Unix : CLAMAV_SOCKET défini → connexion locale (natif macOS/Linux)
 *   - TCP          : CLAMAV_HOST + CLAMAV_PORT → connexion réseau (Docker)
 *
 * Placement dans la pipeline :
 *   multipartUpload → validateUpload → inspectArchive → [scanUpload] → moveFilesToUploads
 *
 * Comportement :
 *   - CLAMAV_ENABLED !== 'true' → pass-through (next())
 *   - Fichier infecté → 422 + suppression des fichiers tmp
 *   - Erreur de connexion à clamd → 503 + log erreur (fail-closed)
 *   - Aucun fichier → next()
 * ================================================================
 */

import NodeClam from 'clamscan';
import { apiLogger, errorLogger } from '../../../config/logger.js';
import { removeFile } from '../../../helpers/upload_utils.js';

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED === 'true';
const CLAMAV_SOCKET = process.env.CLAMAV_SOCKET || '';
const CLAMAV_HOST = process.env.CLAMAV_HOST || '127.0.0.1';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT, 10) || 3310;

// Instance ClamScan (initialisée une seule fois au premier scan)
let clamInstance = null;

/**
 * Initialise le client ClamAV (lazy — uniquement au premier appel)
 * Socket Unix si CLAMAV_SOCKET est défini, sinon TCP (host:port).
 * @returns {Promise<NodeClam>}
 */
async function getClamInstance() {
    if (clamInstance) {
        return clamInstance;
    }

    const useSocket = CLAMAV_SOCKET.length > 0;

    const clamdscanConfig = useSocket
        ? {
              socket: CLAMAV_SOCKET,
              timeout: 30000,
              localFallback: false,
              active: true,
          }
        : {
              host: CLAMAV_HOST,
              port: CLAMAV_PORT,
              timeout: 30000,
              localFallback: false,
              active: true,
          };

    clamInstance = await new NodeClam().init({
        removeInfected: false, // On gère la suppression nous-mêmes
        quarantineInfected: false,
        debugMode: false,
        clamdscan: clamdscanConfig,
        preference: 'clamdscan',
    });

    const connInfo = useSocket ? { socket: CLAMAV_SOCKET } : { host: CLAMAV_HOST, port: CLAMAV_PORT };
    apiLogger.info(connInfo, 'ClamAV client initialized');

    return clamInstance;
}

/**
 * Middleware Express — scan antivirus des fichiers uploadés
 */
export default async function scanUpload(req, res, next) {
    // Pass-through si ClamAV désactivé
    if (!CLAMAV_ENABLED) {
        return next();
    }

    // Pas de fichiers → rien à scanner
    const files = req.files || [];
    if (files.length === 0) {
        return next();
    }

    try {
        const clam = await getClamInstance();

        for (const file of files) {
            const { isInfected, viruses } = await clam.isInfected(file.path);

            if (isInfected) {
                apiLogger.warn(
                    {
                        filename: file.originalname,
                        viruses,
                        ip: req.ip,
                        code: req.params?.code,
                    },
                    'ClamAV: infected file detected'
                );

                // Supprimer TOUS les fichiers de la requête (quarantaine)
                for (const f of files) {
                    await removeFile(f.path).catch((err) => {
                        errorLogger.error({ err, path: f.path }, 'scanUpload: cleanup error');
                    });
                }

                return res.status(422).json({
                    success: false,
                    error: 'File rejected: malware detected',
                    detail: {
                        filename: file.originalname,
                        threats: viruses,
                    },
                });
            }
        }

        // Tous les fichiers sont propres
        apiLogger.debug({ count: files.length, code: req.params?.code }, 'ClamAV: all files clean');

        return next();
    } catch (err) {
        errorLogger.error({ err }, 'scanUpload: ClamAV connection error');

        // Fail-closed : si ClamAV est inaccessible, on bloque l'upload
        // pour ne pas laisser passer un fichier potentiellement dangereux
        for (const f of files) {
            await removeFile(f.path).catch(() => {});
        }

        return res.status(503).json({
            success: false,
            error: 'Antivirus scan unavailable, upload rejected',
        });
    }
}
