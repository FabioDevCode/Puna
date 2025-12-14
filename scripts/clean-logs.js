import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archiveDir = path.resolve(__dirname, '../logs/archives');

// Durées de rétention par type de log (en jours)
const retentionDays = {
    app: parseInt(process.env.LOG_RETENTION_APP, 10) || 7,
    api: parseInt(process.env.LOG_RETENTION_API, 10) || 14,
    error: parseInt(process.env.LOG_RETENTION_ERROR, 10) || 30,
    audit: parseInt(process.env.LOG_RETENTION_AUDIT, 10) || 90,
};

/**
 * Nettoie les logs anciens selon les durées de rétention
 */
async function cleanOldLogs() {
    console.log('Nettoyage des logs anciens...');
    console.log(`Dossier: ${archiveDir}`);
    console.log('⏱Rétention:', retentionDays);
    console.log('');

    try {
        // Vérifier que le dossier existe
        try {
            await fs.access(archiveDir);
        } catch (error) {
            console.log('Dossier archives non trouvé, rien à nettoyer');
            return;
        }

        const files = await fs.readdir(archiveDir);
        const now = Date.now();
        let deletedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(archiveDir, file);
            const stats = await fs.stat(filePath);
            const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

            // Déterminer le type de log selon le nom du fichier
            let maxAge = 7; // Par défaut
            if (file.startsWith('error-')) {
                maxAge = retentionDays.error;
            } else if (file.startsWith('api-')) {
                maxAge = retentionDays.api;
            } else if (file.startsWith('audit-')) {
                maxAge = retentionDays.audit;
            } else if (file.startsWith('app-')) {
                maxAge = retentionDays.app;
            }

            // Supprimer si trop vieux
            if (ageInDays > maxAge) {
                await fs.unlink(filePath);
                totalSize += stats.size;
                console.log(`🗑️  Supprimé: ${file} (${Math.floor(ageInDays)} jours, ${formatBytes(stats.size)})`);
                deletedCount++;
            }
        }

        console.log('');
        console.log(`Nettoyage terminé: ${deletedCount} fichier(s) supprimé(s)`);
        if (totalSize > 0) {
            console.log(`Espace libéré: ${formatBytes(totalSize)}`);
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage:', error.message);
        process.exit(1);
    }
}

/**
 * Formatte les bytes en unités lisibles
 * @param {number} bytes - Nombre de bytes
 * @returns {string} Taille formatée
 */
function formatBytes(bytes) {
    if (bytes === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Exécuter le nettoyage
cleanOldLogs();
