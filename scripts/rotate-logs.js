import path from 'path';
import { fileURLToPath } from 'url';
import { rotateAllLogs } from '../src/config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Script de rotation manuelle des logs
 * Utilise la fonction rotateAllLogs du logger pour éviter la duplication de code
 */
async function manualRotation() {
    console.log('🔄 Rotation manuelle des logs...');
    console.log('');

    try {
        await rotateAllLogs();

        console.log('');
        console.log('✨ Rotation terminée avec succès');
        console.log('');
        console.log('💡 Astuce: Utilisez "node scripts/logs-stats.js" pour voir les statistiques');
        console.log('💡 Astuce: Utilisez "node scripts/clean-logs.js" pour nettoyer les anciennes archives');
    } catch (error) {
        console.error('❌ Erreur lors de la rotation:', error.message);
        process.exit(1);
    }
}

// Exécuter la rotation manuelle
manualRotation();
