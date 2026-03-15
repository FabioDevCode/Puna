import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../src/utils/errors.js';

describe('errors utils', () => {
    describe('AppError', () => {
        it('should set message and statusCode', () => {
            const err = new AppError('custom', 502);
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
            expect(err.message).toBe('custom');
            expect(err.statusCode).toBe(502);
        });

        it('should have name equal to constructor name', () => {
            const err = new AppError('msg', 500);
            expect(err.name).toBe('AppError');
        });
    });

    describe('NotFoundError', () => {
        it('should be instance of Error and AppError', () => {
            const err = new NotFoundError();
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        });

        it('should have statusCode 404 and default message', () => {
            const err = new NotFoundError();
            expect(err.statusCode).toBe(404);
            expect(err.message).toBe('Ressource introuvable');
        });

        it('should have name NotFoundError', () => {
            expect(new NotFoundError().name).toBe('NotFoundError');
        });
    });

    describe('ForbiddenError', () => {
        it('should be instance of Error and AppError', () => {
            const err = new ForbiddenError();
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        });

        it('should have statusCode 403 and default message', () => {
            const err = new ForbiddenError();
            expect(err.statusCode).toBe(403);
            expect(err.message).toBe('Accès refusé');
        });

        it('should have name ForbiddenError', () => {
            expect(new ForbiddenError().name).toBe('ForbiddenError');
        });
    });

    describe('ValidationError', () => {
        it('should be instance of Error and AppError', () => {
            const err = new ValidationError();
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        });

        it('should have statusCode 400 and default message', () => {
            const err = new ValidationError();
            expect(err.statusCode).toBe(400);
            expect(err.message).toBe('Données invalides');
        });

        it('should have name ValidationError', () => {
            expect(new ValidationError().name).toBe('ValidationError');
        });
    });

    describe('UnauthorizedError', () => {
        it('should be instance of Error and AppError', () => {
            const err = new UnauthorizedError();
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        });

        it('should have statusCode 401 and default message', () => {
            const err = new UnauthorizedError();
            expect(err.statusCode).toBe(401);
            expect(err.message).toBe('Authentification requise');
        });

        it('should have name UnauthorizedError', () => {
            expect(new UnauthorizedError().name).toBe('UnauthorizedError');
        });
    });
});
