import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesFiles = fs.readdirSync(__dirname).filter((file) => file.endsWith('routes.js'));

export default async (app) => {
    for (const file of routesFiles) {
        const isDefault = file === 'default.routes.js';
        const routePath = isDefault ? '/' : `/${file.split('.')[0]}`;
        const filePath = path.join(__dirname, file);

        try {
            const module = await import(filePath);
            const routes = module.default;

            if (routes) {
                app.use(routePath, routes);
            } else {
                console.error(`Error: This route file ${file} does not export a router.`);
            }
        } catch (err) {
            console.error(`Error loading route from ${file}: ${err.message}`);
        }
    }
};
