import { describe, it, expect } from 'vitest';
import { isValidDomain, isValidFormName } from '../../../src/utils/validators.js';

describe('isValidDomain', () => {
    // --- Cas valides ---
    it('accepte un domaine simple', () => {
        expect(isValidDomain('example.com')).toEqual({ valid: true, error: null });
    });

    it('accepte un sous-domaine', () => {
        expect(isValidDomain('sub.example.com')).toEqual({ valid: true, error: null });
    });

    it('accepte un domaine avec tirets', () => {
        expect(isValidDomain('my-site.example.com')).toEqual({ valid: true, error: null });
    });

    it('accepte un domaine avec chiffres', () => {
        expect(isValidDomain('site123.io')).toEqual({ valid: true, error: null });
    });

    it('accepte un TLD long', () => {
        expect(isValidDomain('example.museum')).toEqual({ valid: true, error: null });
    });

    // --- Cas invalides ---
    it('rejette null', () => {
        expect(isValidDomain(null).valid).toBe(false);
        expect(isValidDomain(null).error).toBe('validation.domain_required');
    });

    it('rejette undefined', () => {
        expect(isValidDomain(undefined).valid).toBe(false);
    });

    it('rejette une chaîne vide', () => {
        expect(isValidDomain('').valid).toBe(false);
        expect(isValidDomain('').error).toBe('validation.domain_required');
    });

    it('rejette une chaîne avec seulement des espaces', () => {
        expect(isValidDomain('   ').valid).toBe(false);
        expect(isValidDomain('   ').error).toBe('validation.domain_required');
    });

    it('rejette un domaine trop long (> 253 chars)', () => {
        const long = 'a'.repeat(250) + '.com';
        expect(isValidDomain(long).valid).toBe(false);
        expect(isValidDomain(long).error).toBe('validation.domain_too_long');
    });

    it('rejette un domaine sans TLD', () => {
        expect(isValidDomain('localhost').valid).toBe(false);
        expect(isValidDomain('localhost').error).toBe('validation.domain_invalid_format');
    });

    it('rejette un domaine avec un TLD de 1 lettre', () => {
        expect(isValidDomain('example.a').valid).toBe(false);
    });

    it('rejette un domaine avec espaces', () => {
        expect(isValidDomain('example .com').valid).toBe(false);
    });

    it('rejette un domaine commençant par un tiret', () => {
        expect(isValidDomain('-example.com').valid).toBe(false);
    });

    it('rejette un domaine finissant par un tiret dans un label', () => {
        expect(isValidDomain('example-.com').valid).toBe(false);
    });

    it('rejette un domaine avec underscores', () => {
        expect(isValidDomain('ex_ample.com').valid).toBe(false);
    });

    it('rejette un domaine avec un protocole', () => {
        expect(isValidDomain('https://example.com').valid).toBe(false);
    });

    it('rejette un non-string (number)', () => {
        expect(isValidDomain(42).valid).toBe(false);
    });
});

describe('isValidFormName', () => {
    // --- Cas valides ---
    it('accepte un nom simple', () => {
        expect(isValidFormName('Contact')).toEqual({ valid: true, error: null });
    });

    it('accepte un nom avec espaces', () => {
        expect(isValidFormName('Mon formulaire')).toEqual({ valid: true, error: null });
    });

    it('accepte un nom avec tirets et underscores', () => {
        expect(isValidFormName('form-name_v2')).toEqual({ valid: true, error: null });
    });

    it('accepte un nom avec des accents', () => {
        expect(isValidFormName('Réclamation été')).toEqual({ valid: true, error: null });
    });

    it('accepte un nom avec des chiffres', () => {
        expect(isValidFormName('Formulaire 3')).toEqual({ valid: true, error: null });
    });

    it('accepte un nom avec un point', () => {
        expect(isValidFormName('v2.0')).toEqual({ valid: true, error: null });
    });

    // --- Cas invalides ---
    it('rejette null', () => {
        expect(isValidFormName(null).valid).toBe(false);
        expect(isValidFormName(null).error).toBe('validation.form_name_required');
    });

    it('rejette une chaîne vide', () => {
        expect(isValidFormName('').valid).toBe(false);
    });

    it('rejette une chaîne avec seulement des espaces', () => {
        expect(isValidFormName('   ').valid).toBe(false);
        expect(isValidFormName('   ').error).toBe('validation.form_name_required');
    });

    it('rejette un nom trop long (> 50 chars)', () => {
        const long = 'a'.repeat(51);
        expect(isValidFormName(long).valid).toBe(false);
        expect(isValidFormName(long).error).toBe('validation.form_name_too_long');
    });

    it('rejette un nom avec des caractères spéciaux interdits', () => {
        expect(isValidFormName('form<script>').valid).toBe(false);
        expect(isValidFormName('form<script>').error).toBe('validation.form_name_invalid_chars');
    });

    it('rejette un nom avec @', () => {
        expect(isValidFormName('contact@form').valid).toBe(false);
    });

    it('rejette un nom avec des slashes', () => {
        expect(isValidFormName('path/form').valid).toBe(false);
    });

    it('rejette un non-string (number)', () => {
        expect(isValidFormName(123).valid).toBe(false);
    });
});
