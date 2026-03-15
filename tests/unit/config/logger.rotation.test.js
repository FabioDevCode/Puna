import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock des dépendances lourdes pour éviter de charger le vrai logger
vi.mock('node-cron', () => ({
    default: { schedule: vi.fn() },
}));

vi.mock('pino', () => {
    const dest = vi.fn(() => ({}));
    const multistream = vi.fn(() => ({}));
    const transport = vi.fn(() => ({}));
    const pino = vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }));
    pino.destination = dest;
    pino.multistream = multistream;
    pino.transport = transport;
    pino.stdTimeFunctions = { isoTime: () => `,"time":"${new Date().toISOString()}"` };
    return { default: pino };
});

vi.mock('tar', () => ({
    create: vi.fn(async () => {}),
}));

// Forcer NODE_ENV à 'development' pour que la config du logger fonctionne
vi.stubEnv('NODE_ENV', 'development');

// Import direct des fonctions utilitaires (les mocks ci-dessus empêchent les effets de bord)
const { getLastLogDate, archiveLogs: _archiveLogs, checkAndRotateOnStartup: _checkAndRotateOnStartup, formatBytes } = await import('../../../src/config/logger.js');

describe('logger rotation', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'puna-log-test-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    // ===========================================
    // getLastLogDate
    // ===========================================
    describe('getLastLogDate', () => {
        it('retourne null pour un fichier absent', async () => {
            const result = await getLastLogDate(path.join(tmpDir, 'inexistant.log'));
            expect(result).toBeNull();
        });

        it('retourne null pour un fichier vide', async () => {
            const filePath = path.join(tmpDir, 'empty.log');
            await fs.writeFile(filePath, '');
            const result = await getLastLogDate(filePath);
            expect(result).toBeNull();
        });

        it('retourne null pour un fichier contenant uniquement des espaces/newlines', async () => {
            const filePath = path.join(tmpDir, 'whitespace.log');
            await fs.writeFile(filePath, '\n  \n\n');
            const result = await getLastLogDate(filePath);
            expect(result).toBeNull();
        });

        it('extrait la date de la dernière ligne JSON valide (pino isoTime)', async () => {
            const filePath = path.join(tmpDir, 'app.log');
            const lines = ['{"level":30,"time":"2026-03-12T10:00:00.000Z","msg":"ancien"}', '{"level":30,"time":"2026-03-13T14:30:00.000Z","msg":"récent"}'].join('\n');
            await fs.writeFile(filePath, lines + '\n');

            const result = await getLastLogDate(filePath);
            expect(result).toBe('2026-03-13');
        });

        it('gère un fichier avec une seule ligne', async () => {
            const filePath = path.join(tmpDir, 'single.log');
            await fs.writeFile(filePath, '{"level":30,"time":"2026-01-15T08:00:00.000Z","msg":"seul"}\n');

            const result = await getLastLogDate(filePath);
            expect(result).toBe('2026-01-15');
        });

        it('fallback sur mtime si le JSON est invalide', async () => {
            const filePath = path.join(tmpDir, 'bad.log');
            await fs.writeFile(filePath, 'ceci nest pas du json\n');

            const result = await getLastLogDate(filePath);
            // Doit retourner la date mtime du fichier (aujourd'hui)
            const today = new Date().toISOString().split('T')[0];
            expect(result).toBe(today);
        });

        it('fallback sur mtime si le champ time est absent du JSON', async () => {
            const filePath = path.join(tmpDir, 'notime.log');
            await fs.writeFile(filePath, '{"level":30,"msg":"pas de time"}\n');

            const result = await getLastLogDate(filePath);
            const today = new Date().toISOString().split('T')[0];
            expect(result).toBe(today);
        });
    });

    // ===========================================
    // formatBytes
    // ===========================================
    describe('formatBytes', () => {
        it('retourne "0 Bytes" pour 0', () => {
            expect(formatBytes(0)).toBe('0 Bytes');
        });

        it('formate correctement les KB', () => {
            expect(formatBytes(1024)).toBe('1 KB');
        });

        it('formate correctement les MB', () => {
            expect(formatBytes(1048576)).toBe('1 MB');
        });

        it('formate avec décimales', () => {
            expect(formatBytes(1536)).toBe('1.5 KB');
        });
    });
});
