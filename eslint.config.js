import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import jsoncPlugin from 'eslint-plugin-jsonc';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import jsoncParser from 'jsonc-eslint-parser';

export default [
    // Config recommandée de base
    js.configs.recommended,

    // Config globale Node.js
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        plugins: {
            'import-x': importPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            'prettier/prettier': 'error',
            indent: 'off',
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-empty': 'warn',
            'comma-dangle': ['error', 'only-multiline'],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
            'keyword-spacing': ['error', { before: true, after: true }],
            'space-infix-ops': 'error',
            'comma-spacing': ['error', { before: false, after: true }],
            'brace-style': ['error', '1tbs', { allowSingleLine: true }],
            curly: ['error', 'all'],
            'no-multi-spaces': 'error',
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    pathGroups: [{ pattern: 'node:**', group: 'builtin', position: 'before' }],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    'newlines-between': 'never',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import-x/newline-after-import': ['error', { count: 1 }],
            'import-x/no-duplicates': 'error',
        },
    },

    // Override pour les fichiers JS côté navigateur (src/public/js/)
    {
        files: ['src/public/js/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ApexCharts: 'readonly',
                Toastify: 'readonly',
                Toast: 'readonly',
            },
        },
        rules: {
            'import-x/order': 'off',
            'import-x/newline-after-import': 'off',
            'no-inner-declarations': 'off',
        },
    },

    // Override pour les fichiers JSON (package.json)
    {
        files: ['package.json', 'package-lock.json'],
        plugins: { jsonc: jsoncPlugin },
        languageOptions: { parser: jsoncParser },
        rules: {
            'jsonc/sort-keys': 'off',
            'jsonc/indent': ['error', 'tab'],
        },
    },

    // Override pour les autres JSON
    {
        files: ['*.json', '**/*.json'],
        ignores: ['package.json', 'package-lock.json'],
        plugins: { jsonc: jsoncPlugin },
        languageOptions: { parser: jsoncParser },
        rules: {
            'jsonc/sort-keys': ['error', 'asc', { caseSensitive: false, natural: true }],
            'jsonc/indent': ['error', 4],
        },
    },

    // Override pour les fichiers de test (Vitest globals)
    {
        files: ['tests/**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },

    // Prettier en dernier (désactive les règles de formatage conflictuelles)
    prettierConfig,

    // Ignorer les fichiers (remplace .eslintignore)
    {
        ignores: [
            'node_modules/',
            'coverage/',
            'logs/',
            'storage/',
            'Puna/',
            '**/*.hbs',
            '**/*.min.js',
            'src/public/plugins/',
        ],
    },
];
