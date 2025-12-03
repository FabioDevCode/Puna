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

// Blocs qui ouvrent/ferment
const BLOCK_OPEN = /^(\s*){{#(if|unless|each|with|slot|actionCan|roleIs|isRole|isAdmin)\b/;
const BLOCK_CLOSE = /^(\s*){{\/([a-zA-Z]+)}}/;
const ELSE_BLOCK = /^(\s*){{else}}/;

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

        // Fermeture de bloc {{/xxx}}
        if (BLOCK_CLOSE.test(trimmed)) {
            indentLevel = Math.max(0, indentLevel - 1);
            formatted.push(INDENT.repeat(indentLevel) + trimmed);
            continue;
        }

        // {{else}}
        if (ELSE_BLOCK.test(trimmed)) {
            formatted.push(INDENT.repeat(Math.max(0, indentLevel - 1)) + trimmed);
            continue;
        }

        // Ouverture de bloc {{#xxx}}
        if (BLOCK_OPEN.test(trimmed)) {
            formatted.push(INDENT.repeat(indentLevel) + trimmed);
            indentLevel++;
            continue;
        }

        // Ligne normale (HTML, texte, helpers simples)
        formatted.push(INDENT.repeat(indentLevel) + trimmed);
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
