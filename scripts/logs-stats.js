import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, '../logs');
const archiveDir = path.join(logDir, 'archives');

console.log('Statistiques des logs Puna\n');

// ============================================
// 1. Taille des logs actifs
// ============================================
console.log('Logs actifs:');
try {
    const files = ['app.log', 'api.log', 'error.log', 'audit.log'];
    let totalActiveSize = 0;

    files.forEach((file) => {
        const filePath = path.join(logDir, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            totalActiveSize += stats.size;
            console.log(`   ${file.padEnd(15)} ${formatBytes(stats.size).padStart(10)}`);
        } else {
            console.log(`   ${file.padEnd(15)} ${'N/A'.padStart(10)}`);
        }
    });

    console.log(`   ${'TOTAL'.padEnd(15)} ${formatBytes(totalActiveSize).padStart(10)}`);
    console.log('');
} catch (error) {
    console.error('   Erreur:', error.message);
    console.log('');
}

// ============================================
// 2. Nombre de lignes dans les logs actifs
// ============================================
console.log('Nombre de lignes (logs actifs):');
['app.log', 'api.log', 'error.log', 'audit.log'].forEach((file) => {
    const filePath = path.join(logDir, file);
    if (fs.existsSync(filePath)) {
        try {
            const lines = execSync(`wc -l < "${filePath}"`, { encoding: 'utf-8' }).trim();
            console.log(`   ${file.padEnd(15)} ${lines.padStart(10)} lignes`);
        } catch (_error) {
            console.log(`   ${file.padEnd(15)} ${'0'.padStart(10)} lignes`);
        }
    } else {
        console.log(`   ${file.padEnd(15)} ${'N/A'.padStart(10)}`);
    }
});
console.log('');

// ============================================
// 3. Archives
// ============================================
console.log('Archives (.gz):');
try {
    if (fs.existsSync(archiveDir)) {
        const archiveFiles = fs.readdirSync(archiveDir);
        const archives = archiveFiles.filter((f) => f.endsWith('.gz'));

        if (archives.length === 0) {
            console.log('   Aucune archive');
        } else {
            let totalArchiveSize = 0;
            const archivesByType = {
                app: [],
                api: [],
                error: [],
                audit: [],
            };

            // Classer les archives par type
            archives.forEach((file) => {
                const filePath = path.join(archiveDir, file);
                const stats = fs.statSync(filePath);
                totalArchiveSize += stats.size;

                if (file.startsWith('app-')) {
                    archivesByType.app.push({ file, size: stats.size });
                } else if (file.startsWith('api-')) {
                    archivesByType.api.push({ file, size: stats.size });
                } else if (file.startsWith('error-')) {
                    archivesByType.error.push({ file, size: stats.size });
                } else if (file.startsWith('audit-')) {
                    archivesByType.audit.push({ file, size: stats.size });
                }
            });

            // Afficher par type
            Object.keys(archivesByType).forEach((type) => {
                const typeArchives = archivesByType[type];
                if (typeArchives.length > 0) {
                    const typeSize = typeArchives.reduce((sum, a) => sum + a.size, 0);
                    console.log(`   ${type.padEnd(10)} ${typeArchives.length} fichier(s)  ${formatBytes(typeSize)}`);
                }
            });

            console.log(`   ${'TOTAL'.padEnd(10)} ${archives.length} fichier(s)  ${formatBytes(totalArchiveSize)}`);
        }
    } else {
        console.log('   Dossier archives non trouvé');
    }
} catch (error) {
    console.error('   Erreur:', error.message);
}
console.log('');

// ============================================
// 4. Espace disque total
// ============================================
console.log('Espace disque total:');
try {
    if (fs.existsSync(logDir)) {
        const totalSize = execSync(`du -sh "${logDir}"`, { encoding: 'utf-8' }).toString().split('\t')[0];
        console.log(`   ${totalSize}`);
    } else {
        console.log('   Dossier logs non trouvé');
    }
} catch (error) {
    console.log(`   Calcul impossible: ${error.message}`);
}
console.log('');

// ============================================
// 5. Dernières erreurs
// ============================================
console.log('Dernières erreurs (5 dernières):');
const errorLogPath = path.join(logDir, 'error.log');
if (fs.existsSync(errorLogPath)) {
    try {
        const errorLog = fs.readFileSync(errorLogPath, 'utf-8');
        const lines = errorLog.split('\n').filter(Boolean);

        if (lines.length === 0) {
            console.log('   Aucune erreur enregistrée');
        } else {
            const lastErrors = lines.slice(-5).reverse();
            lastErrors.forEach((line) => {
                try {
                    const log = JSON.parse(line);
                    const time = new Date(log.time).toLocaleString('fr-FR');
                    const message = log.msg || log.err?.message || 'N/A';
                    console.log(`   [${time}] ${message.substring(0, 60)}${message.length > 60 ? '...' : ''}`);
                } catch (_e) {
                    console.log(`   ${line.substring(0, 80)}...`);
                }
            });
        }
    } catch (error) {
        console.log(`   Erreur lecture: ${error.message}`);
    }
} else {
    console.log('   Fichier error.log non trouvé');
}
console.log('');

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
