import http from 'node:http';
import app from './src/app.js';
import { registerCronJobs } from './src/config/cron.js';
import { validateEnv } from './src/config/env.validator.js';
import { logger } from './src/config/logger.js';
import models from './src/models/index.js';

// Valider les variables d'environnement AVANT tout le reste
await validateEnv();

const PORT = process.env.PORT || 3022;
const server = http.createServer(app);

server.listen(PORT, () => {
    logger.info({ port: PORT }, `Puna started on port ${PORT}`);
    registerCronJobs();
});

/**
 * Fermeture gracieuse du serveur
 * - Ferme les connexions entrantes
 * - Ferme la base de données
 * - Force kill après timeout de sécurité
 */
function shutdownAndExit(error) {
    logger.error(error, 'Critical error - initiating graceful shutdown');

    // Fermer les nouvelles connexions
    server.close(() => {
        logger.info('HTTP server closed');

        // Fermer la connexion Sequelize
        models.sequelize
            .close()
            .then(() => {
                logger.info('Database connection closed');
                process.exit(1);
            })
            .catch((err) => {
                logger.error(err, 'Error closing database connection');
                process.exit(1);
            });
    });

    // Sécurité : kill forcé après timeout si fermeture trop lente
    setTimeout(() => {
        logger.error('Shutdown timeout - forcing exit');
        process.exit(1);
    }, 5000);
}

/**
 * Gestion des exceptions non capturées
 */
process.on('uncaughtException', (err) => {
    shutdownAndExit(err);
});

/**
 * Gestion des promesses rejetées non capturées
 */
process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    shutdownAndExit(error);
});
