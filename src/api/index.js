import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (app) => {
    // Lire tous les dossiers de version (commençant par 'v')
    const versionDirs = fs.readdirSync(__dirname, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^v\d+/.test(dirent.name))
        .map((dirent) => dirent.name);

    for (const version of versionDirs) {
        const versionPath = path.join(__dirname, version);
        // Lire tous les fichiers .api.js
        const apiFiles = fs.readdirSync(versionPath)
            .filter((file) => file.endsWith('.api.js'));

        for (const file of apiFiles) {
            let routePath;

            if (file === 'default.api.js') {
                routePath = `/api/${version}`;
            } else {
                const entity = file.replace(/\.api\.js$/, '');
                routePath = `/api/${version}/${entity}`;
            }
            const filePath = path.join(versionPath, file);

            try {
                const module = await import(filePath);
                const apiRouter = module.default;
                if (apiRouter) {
                    app.use(routePath, apiRouter);
                } else {
                    console.error(`Error: This API file ${file} does not export a router.`);
                }
            } catch (err) {
                console.error(`Error loading API from ${file}: ${err.message}`);
            }
        }
    }
};
