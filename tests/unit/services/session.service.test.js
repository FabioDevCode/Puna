/**
 * @file tests/unit/services/session.service.test.js
 * Unit tests for the session service (destroyUserSessions).
 * The session store is fully mocked via sessionStore config module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionStore } from '../../../src/config/sessionStore.js';
import { destroyUserSessions } from '../../../src/services/session.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    errorLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

const mockQuery = vi.fn();

vi.mock('../../../src/config/sessionStore.js', () => ({
    getSessionStore: vi.fn(),
    setSessionStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('session.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('destroyUserSessions()', () => {
        it('retourne 0 silencieusement si le store est null (SQLite/MemoryStore)', async () => {
            getSessionStore.mockReturnValue(null);

            const result = await destroyUserSessions('user-123');

            expect(result).toBe(0);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('retourne 0 silencieusement si le store est undefined', async () => {
            getSessionStore.mockReturnValue(undefined);

            const result = await destroyUserSessions('user-123');

            expect(result).toBe(0);
        });

        it('exécute la requête DELETE avec JSON_EXTRACT et retourne le nombre de sessions supprimées', async () => {
            mockQuery.mockResolvedValue({ affectedRows: 2 });
            getSessionStore.mockReturnValue({ query: mockQuery });

            const result = await destroyUserSessions('user-abc-123');

            expect(result).toBe(2);
            expect(mockQuery).toHaveBeenCalledOnce();
            expect(mockQuery).toHaveBeenCalledWith('DELETE FROM sessions WHERE JSON_EXTRACT(data, ?) = ?', ['$.user.id', 'user-abc-123']);
        });

        it('log un audit quand des sessions sont supprimées', async () => {
            mockQuery.mockResolvedValue({ affectedRows: 3 });
            getSessionStore.mockReturnValue({ query: mockQuery });

            const { auditLogger } = await import('../../../src/config/logger.js');

            await destroyUserSessions('user-456');

            expect(auditLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_SESSIONS_PURGED',
                    userId: 'user-456',
                    deletedSessions: 3,
                })
            );
        });

        it("ne log pas d'audit quand aucune session n'est supprimée", async () => {
            mockQuery.mockResolvedValue({ affectedRows: 0 });
            getSessionStore.mockReturnValue({ query: mockQuery });

            const { auditLogger } = await import('../../../src/config/logger.js');

            await destroyUserSessions('user-789');

            expect(auditLogger.info).not.toHaveBeenCalled();
        });

        it('attrape les erreurs SQL, log et retourne 0 sans propager', async () => {
            mockQuery.mockRejectedValue(new Error('Connection lost'));
            getSessionStore.mockReturnValue({ query: mockQuery });

            const { errorLogger } = await import('../../../src/config/logger.js');

            const result = await destroyUserSessions('user-err');

            expect(result).toBe(0);
            expect(errorLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_SESSIONS_PURGE_ERROR',
                    userId: 'user-err',
                    error: 'Connection lost',
                }),
                expect.any(String)
            );
        });

        it('gère le cas où result est undefined (pas de affectedRows)', async () => {
            mockQuery.mockResolvedValue(undefined);
            getSessionStore.mockReturnValue({ query: mockQuery });

            const result = await destroyUserSessions('user-undef');

            expect(result).toBe(0);
        });
    });
});
