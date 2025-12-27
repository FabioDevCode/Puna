import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const logDir = path.join(projectRoot, 'logs');
const archiveDir = path.join(logDir, 'archives');

/**
 * Formatte les bytes en unités lisibles
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

/**
 * Script de rotation manuelle des logs
 * Crée une archive avec le suffixe "-manual" et l'heure exacte
 * Format: YYYY-MM-DD-HHmmss-manual.tar.gz
 */
async function manualRotation() {
    console.log('Rotation manuelle des logs...');
    console.log(`Dossier: ${logDir}`);
    console.log('');

    try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHmmss
        const archiveName = `${dateStr}-${timeStr}-manual.tar.gz`;
        const archivePath = path.join(archiveDir, archiveName);

        // Créer le dossier archives s'il n'existe pas
        try {
            await fs.access(archiveDir);
        } catch {
            await fs.mkdir(archiveDir, { recursive: true });
            console.log('Dossier archives créé');
        }

        const logFiles = ['app.log', 'api.log', 'error.log', 'audit.log'];
        const filesToArchive = [];

        // Vérifier quels fichiers existent et ne sont pas vides
        console.log('Fichiers à archiver:');
        for (const logFile of logFiles) {
            const logPath = path.join(logDir, logFile);
            try {
                const stats = await fs.stat(logPath);
                if (stats.size > 0) {
                    filesToArchive.push(logFile);
                    console.log(`   ✓ ${logFile} (${formatBytes(stats.size)})`);
                } else {
                    console.log(`   ⊘ ${logFile} (vide)`);
                }
            } catch {
                console.log(`   ⊘ ${logFile} (non trouvé)`);
            }
        }
        console.log('');

        if (filesToArchive.length === 0) {
            console.log('Aucun fichier à archiver');
            return;
        }

        // Créer l'archive tar.gz
        console.log(`Création de l'archive: ${archiveName}`);
        await tar.create(
            {
                gzip: true,
                file: archivePath,
                cwd: logDir,
            },
            filesToArchive
        );

        // Vider les fichiers archivés
        await Promise.all(
            filesToArchive.map((logFile) => {
                const logPath = path.join(logDir, logFile);
                return fs.writeFile(logPath, '');
            })
        );

        const archiveStats = await fs.stat(archivePath);
        console.log(`   Taille: ${formatBytes(archiveStats.size)}`);
        console.log('');
        console.log('Rotation manuelle terminée avec succès');
        console.log('');
        console.log('Astuce: Utilisez "npm run logs:stats" pour voir les statistiques');
        console.log('Astuce: Utilisez "npm run logs:clean" pour nettoyer les anciennes archives');
    } catch (error) {
        console.error('Erreur lors de la rotation:', error.message);
        process.exit(1);
    }
}

// Exécuter la rotation manuelle
manualRotation();
