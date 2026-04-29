import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger, errorLogger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesFiles = fs.readdirSync(__dirname).filter((file) => file.endsWith('routes.js'));

export default async (app) => {
    for (const file of routesFiles) {
        const isDefault = file === 'default.routes.js';
        const routePath = isDefault ? '/' : `/${path.basename(file, '.routes.js')}`;
        const filePath = path.join(__dirname, file);
        const fileUrl = pathToFileURL(filePath).href;

        try {
            const module = await import(fileUrl);
            const routes = module.default;

            if (routes) {
                app.use(routePath, routes);
            } else {
                logger.warn({ file }, 'Route file does not export a router');
            }
        } catch (err) {
            errorLogger.error({ err, file }, 'Error loading route file');
        }
    }
};
