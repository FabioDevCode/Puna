/**
 * Helper pour la compilation des templates emails Handlebars
 * Lit les fichiers .hbs depuis src/views/emails/ et les compile avec leurs variables
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_TEMPLATES_DIR = path.join(__dirname, '../views/emails');

/** Cache des templates compilés pour éviter de relire le disque à chaque envoi */
const templateCache = new Map();

/**
 * Compile un template email Handlebars et retourne le HTML final
 * @param {string} templateName - Nom du fichier sans extension (ex: 'reset-password')
 * @param {Record<string, unknown>} context - Variables injectées dans le template
 * @returns {Promise<string>} - HTML compilé
 */
export async function renderMailTemplate(templateName, context = {}) {
    let compiledTemplate = templateCache.get(templateName);

    if (!compiledTemplate) {
        const filePath = path.join(EMAIL_TEMPLATES_DIR, `${templateName}.hbs`);
        const source = await fs.readFile(filePath, 'utf-8');
        compiledTemplate = Handlebars.compile(source);
        templateCache.set(templateName, compiledTemplate);
    }

    return compiledTemplate(context);
}
