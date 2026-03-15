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
const HTML_VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function formatHandlebars(content) {
    // Vérifier si le fichier original se termine par un saut de ligne
    const endsWithNewline = content.endsWith('\n');

    // Supprimer les lignes vides finales créées par split
    const lines = content.split('\n');
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    const formatted = [];
    let indentLevel = 0;
    let pendingTagOpen = false; // Balise qui a commencé mais n'est pas terminée

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
            pendingTagOpen = false;
        } else if (ELSE_BLOCK.test(trimmed)) {
            // 2. {{else}}
            lineIndent = Math.max(0, indentLevel - 1);
            pendingTagOpen = false;
        } else if (BLOCK_OPEN.test(trimmed)) {
            // 3. Ouverture de bloc Handlebars {{#xxx}}
            lineIndent = indentLevel;
            adjustAfter = 1;
            pendingTagOpen = false;
        } else {
            // 4. Analyser HTML

            // Vérifier si c'est une ligne d'attributs (continuation de balise)
            const isAttributeLine =
                pendingTagOpen &&
                !trimmed.includes('<') &&
                !trimmed.startsWith('>') &&
                (trimmed.includes('=') || trimmed.includes('class') || trimmed.includes('id') || trimmed.includes('data-') || trimmed.includes('href') || trimmed.includes('src'));

            if (isAttributeLine) {
                // Ligne d'attributs - même niveau que la balise ouvrante
                lineIndent = indentLevel;
                // Vérifier si la ligne se termine par '>'
                if (trimmed.endsWith('>')) {
                    pendingTagOpen = false;
                    adjustAfter = 1; // La balise est maintenant complète
                } else {
                    adjustAfter = 0;
                }
            } else {
                // Compter les balises ouvrantes et fermantes sur cette ligne
                const openTags = [];
                const closeTags = [];

                // Compter les '<' et '>' pour détecter les balises incomplètes
                const openBrackets = (trimmed.match(/</g) || []).length;
                const closeBrackets = (trimmed.match(/>/g) || []).length;

                // Détecter les balises auto-fermantes <tag />
                const scMatches = trimmed.match(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/>/g) || [];
                const selfClosingCount = scMatches.length;

                // Détecter les balises fermantes </tag>
                let match;
                const closeRegex = /<\/([a-zA-Z][a-zA-Z0-9-]*)>/g;
                while ((match = closeRegex.exec(trimmed)) !== null) {
                    closeTags.push(match[1]);
                }

                // Détecter les balises ouvrantes <tag> ou <tag (incomplète)
                const openRegex = /<([a-zA-Z][a-zA-Z0-9-]*)/g;
                while ((match = openRegex.exec(trimmed)) !== null) {
                    const tagName = match[1];
                    // Vérifier que ce n'est pas une balise fermante
                    const beforeMatch = trimmed.substring(0, match.index);
                    if (!beforeMatch.endsWith('/') && !HTML_VOID_ELEMENTS.has(tagName)) {
                        openTags.push(tagName);
                    }
                }

                // Ajuster pour les self-closing tags (ne comptent pas comme ouvertures)
                const realOpenTags = openTags.length - selfClosingCount;

                // Déterminer si une balise commence sans se terminer
                const tagStartsWithoutEnd = openBrackets > closeBrackets;

                // Si la ligne commence par une fermeture
                if (closeTags.length > 0 && trimmed.startsWith('</')) {
                    lineIndent = Math.max(0, indentLevel - 1);
                    adjustAfter = realOpenTags - closeTags.length;
                    pendingTagOpen = false;
                } else {
                    // Balance normale
                    lineIndent = indentLevel;

                    if (tagStartsWithoutEnd && realOpenTags > 0) {
                        // Balise commence mais pas de '>' correspondant
                        pendingTagOpen = true;
                        adjustAfter = 0; // On n'ajuste pas encore, on attend la fin de la balise
                    } else {
                        pendingTagOpen = false;
                        adjustAfter = realOpenTags - closeTags.length;
                    }
                }
            }
        }

        // Appliquer l'indentation
        formatted.push(INDENT.repeat(lineIndent) + trimmed);

        // Ajuster le niveau pour la ligne suivante
        indentLevel = Math.max(0, indentLevel + adjustAfter);
    }

    // Ajouter le saut de ligne final seulement si l'original en avait un
    return formatted.join('\n') + (endsWithNewline ? '\n' : '');
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
