#!/usr/bin/env node

/**
 * Script de formatage pour fichiers Handlebars (.hbs)
 * Indente correctement les blocs {{#if}}, {{#each}}, {{#slot}}, etc.
 *
 * Usage: node scripts/format-hbs.js <file.hbs>
 *        node scripts/format-hbs.js "src/views/pages/sites/show.hbs"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDENT = '    '; // 4 espaces

// Blocs Handlebars qui ouvrent/ferment
const BLOCK_OPEN = /^(\s*){{#(if|unless|each|with|slot|actionCan|roleIs|isRole|isAdmin)\b/;
const BLOCK_CLOSE = /^(\s*){{\/([a-zA-Z]+)}}/;
const ELSE_BLOCK = /^(\s*){{else}}/;

// Balises HTML void (auto-fermantes)
const HTML_VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

function formatHandlebars(content) {
    const lines = content.split('\n');
    const formatted = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Ligne vide
        if (!trimmed) {
            formatted.push('');
            continue;
        }

        // Commentaire HTML ou Handlebars
        if (trimmed.startsWith('<!--') || trimmed.startsWith('{{!')) {
            formatted.push(INDENT.repeat(indentLevel) + trimmed);
            continue;
        }

        // Analyser la ligne pour déterminer l'indentation
        let lineIndent = indentLevel;
        let adjustAfter = 0;

        // 1. Fermeture de bloc Handlebars {{/xxx}}
        if (BLOCK_CLOSE.test(trimmed)) {
            lineIndent = Math.max(0, indentLevel - 1);
            adjustAfter = -1;
        } else if (ELSE_BLOCK.test(trimmed)) {
            // 2. {{else}}
            lineIndent = Math.max(0, indentLevel - 1);
        } else if (BLOCK_OPEN.test(trimmed)) {
            // 3. Ouverture de bloc Handlebars {{#xxx}}
            lineIndent = indentLevel;
            adjustAfter = 1;
        } else {
            // 4. Analyser HTML
            // Compter les balises ouvrantes et fermantes sur cette ligne
            const openTags = [];
            const closeTags = [];
            const selfClosingTags = [];

            // Détecter les balises auto-fermantes <tag />
            let match;
            const scRegex = /<([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/>/g;
            while ((match = scRegex.exec(trimmed)) !== null) {
                selfClosingTags.push(match[1]);
            }

            // Détecter les balises fermantes </tag>
            const closeRegex = /<\/([a-zA-Z][a-zA-Z0-9-]*)>/g;
            while ((match = closeRegex.exec(trimmed)) !== null) {
                closeTags.push(match[1]);
            }

            // Détecter les balises ouvrantes <tag>
            const openRegex = /<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g;
            while ((match = openRegex.exec(trimmed)) !== null) {
                const tagName = match[1];
                const fullMatch = match[0];
                // Ignorer si c'est une balise auto-fermante ou void element
                if (!fullMatch.endsWith('/>') && !HTML_VOID_ELEMENTS.has(tagName)) {
                    openTags.push(tagName);
                }
            }

            // Si la ligne commence par une fermeture
            if (closeTags.length > 0 && trimmed.startsWith('</')) {
                // Nombre de fermetures au début
                let leadingCloses = 0;
                for (const tag of closeTags) {
                    if (trimmed.startsWith(`</${tag}>`)) {
                        leadingCloses++;
                    } else {
                        break;
                    }
                }

                lineIndent = Math.max(0, indentLevel - leadingCloses);
                adjustAfter = openTags.length - closeTags.length;
            } else {
                // Sinon, balance normale
                lineIndent = indentLevel;
                adjustAfter = openTags.length - closeTags.length;
            }
        }

        // Appliquer l'indentation
        formatted.push(INDENT.repeat(lineIndent) + trimmed);

        // Ajuster le niveau pour la ligne suivante
        indentLevel = Math.max(0, indentLevel + adjustAfter);
    }

    return formatted.join('\n') + '\n';
}

async function formatFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const formatted = formatHandlebars(content);

        if (content !== formatted) {
            fs.writeFileSync(filePath, formatted, 'utf-8');
            console.log(`✓ Formatted: ${filePath}`);
            return true;
        } else {
            console.log(`⊘ No changes: ${filePath}`);
            return false;
        }
    } catch (err) {
        console.error(`✗ Error formatting ${filePath}:`, err.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node scripts/format-hbs.js <file.hbs>');
        console.log('       node scripts/format-hbs.js "src/views/**/*.hbs"');
        process.exit(1);
    }

    let files = [];

    for (const arg of args) {
        if (arg.includes('*')) {
            // Pattern glob
            const matches = await glob(arg, { cwd: process.cwd() });
            files.push(...matches);
        } else {
            // Fichier direct
            files.push(arg);
        }
    }

    if (files.length === 0) {
        console.log('No files found.');
        process.exit(0);
    }

    console.log(`Formatting ${files.length} file(s)...\n`);

    let formatted = 0;
    for (const file of files) {
        if (await formatFile(file)) {
            formatted++;
        }
    }

    console.log(`\n✓ Done! Formatted ${formatted}/${files.length} file(s).`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
