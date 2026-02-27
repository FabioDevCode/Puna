import { describe, expect, it, vi } from 'vitest';
import { sanitizeBody, sanitizeParams, sanitizeQuery } from '../../src/middlewares/sanitize.js';

describe('sanitize middleware', () => {
    const makeRes = () => ({});
    const makeNext = () => vi.fn();

    describe('sanitizeBody', () => {
        it('removes script tags from req.body string values', () => {
            const req = { body: { name: '<script>alert(1)</script>' } };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            expect(req.body.name).not.toContain('<script>');
            expect(next).toHaveBeenCalled();
        });

        it('sanitizes nested objects recursively', () => {
            const req = { body: { user: { bio: '<script>evil()</script>' } } };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            expect(req.body.user.bio).not.toContain('<script>');
            expect(next).toHaveBeenCalled();
        });

        it('sanitizes each element of an array of strings', () => {
            const req = { body: { tags: ['<script>a</script>', '<b>bold</b>'] } };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            expect(req.body.tags[0]).not.toContain('<script>');
            expect(req.body.tags[1]).not.toContain('<b>');
            expect(next).toHaveBeenCalled();
        });

        it('leaves non-string values (number, boolean) unchanged', () => {
            const req = { body: { count: 42, active: true } };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            expect(req.body.count).toBe(42);
            expect(req.body.active).toBe(true);
            expect(next).toHaveBeenCalled();
        });

        it('calls next() without error when req.body is null', () => {
            const req = { body: null };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            expect(next).toHaveBeenCalled();
        });

        it('sanitizes object keys to protect against field-name injection', () => {
            const req = { body: { '<script>key</script>': 'value' } };
            const next = makeNext();
            sanitizeBody(req, makeRes(), next);
            const keys = Object.keys(req.body);
            keys.forEach((key) => expect(key).not.toContain('<script>'));
            expect(next).toHaveBeenCalled();
        });
    });

    describe('sanitizeQuery', () => {
        it('removes XSS payload from req.query string values', () => {
            const req = { query: { search: '<img onerror=alert(1)>' } };
            const next = makeNext();
            sanitizeQuery(req, makeRes(), next);
            expect(req.query.search).not.toContain('<img');
            expect(next).toHaveBeenCalled();
        });

        it('calls next() when req.query is an empty object', () => {
            const req = { query: {} };
            const next = makeNext();
            sanitizeQuery(req, makeRes(), next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('sanitizeParams', () => {
        it('removes script tags from req.params string values', () => {
            const req = { params: { id: '<script>xss</script>' } };
            const next = makeNext();
            sanitizeParams(req, makeRes(), next);
            expect(req.params.id).not.toContain('<script>');
            expect(next).toHaveBeenCalled();
        });

        it('leaves non-string param values unchanged', () => {
            const req = { params: { page: 3 } };
            const next = makeNext();
            sanitizeParams(req, makeRes(), next);
            expect(req.params.page).toBe(3);
            expect(next).toHaveBeenCalled();
        });
    });
});
