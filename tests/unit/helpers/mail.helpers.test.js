import fs from 'node:fs/promises';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderMailTemplate } from '../../../src/helpers/mail.helpers.js';

// Mock fs/promises avant l'import du module testé
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
    },
}));

describe('renderMailTemplate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('compile un template avec les variables injectées', async () => {
        fs.readFile.mockResolvedValue('<a href="{{resetUrl}}">Reset</a>');

        const html = await renderMailTemplate('tmpl-inject', { resetUrl: 'https://example.com/reset/abc123' });

        expect(html).toBe('<a href="https://example.com/reset/abc123">Reset</a>');
    });

    it("injecte l'URL correctement dans la structure du template reset-password", async () => {
        const resetUrl = 'https://app.example.com/dp-reset-password/token123';
        fs.readFile.mockResolvedValue('<a href="{{resetUrl}}" style="color:white;">Réinitialiser mon mot de passe</a>');

        const html = await renderMailTemplate('tmpl-reset-url', { resetUrl });

        expect(html).toContain(resetUrl);
        expect(html).toContain('Réinitialiser mon mot de passe');
    });

    it('retourne le HTML sans variable si le contexte est vide', async () => {
        fs.readFile.mockResolvedValue('<p>Bonjour</p>');

        const html = await renderMailTemplate('tmpl-no-context', {});

        expect(html).toBe('<p>Bonjour</p>');
        expect(html).not.toContain('{{');
    });

    it("utilise le cache : fs.readFile n'est appelé qu'une seule fois pour le même template", async () => {
        fs.readFile.mockResolvedValue('<p>{{message}}</p>');

        await renderMailTemplate('tmpl-cached', { message: 'premier' });
        await renderMailTemplate('tmpl-cached', { message: 'second' });

        expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('appelle fs.readFile une fois par template différent', async () => {
        fs.readFile.mockResolvedValue('<p>ok</p>');

        await renderMailTemplate('tmpl-a', {});
        await renderMailTemplate('tmpl-b', {});

        expect(fs.readFile).toHaveBeenCalledTimes(2);
    });

    it('lève une erreur si le fichier template est introuvable', async () => {
        fs.readFile.mockRejectedValue(new Error("ENOENT: no such file or directory, open 'unknown.hbs'"));

        await expect(renderMailTemplate('tmpl-missing', {})).rejects.toThrow('ENOENT');
    });
});
