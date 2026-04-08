/**
 * @file tests/unit/controllers/twoFactor.controller.test.js
 * Unit tests for twoFactor.controller.js
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    dp2faVerifyGet,
    dp2faVerifyPost,
    dp2faRecoveryGet,
    dp2faRecoveryPost,
    dp2faSetupGet,
    dp2faSetupPost,
    dp2faBackupCodesGet,
    dp2faDisablePost,
    dp2faRegeneratePost,
} from '../../../src/controllers/twoFactor.controller.js';
import models from '../../../src/models/index.js';
import { verifyPassword } from '../../../src/services/auth.service.js';
import {
    generateTotpSetup,
    verifyTotpToken,
    generateBackupCodes,
    enableTotpForUser,
    disableTotpForUser,
    regenerateBackupCodes,
    getTotpStatus,
    verifyBackupCode,
} from '../../../src/services/twoFactor.service.js';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted above imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../src/config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    errorLogger: { error: vi.fn(), warn: vi.fn() },
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    rotateAllLogs: vi.fn(),
    formatBytes: vi.fn(),
}));

vi.mock('../../../src/models/index.js', () => ({
    default: {
        User: {
            findByPk: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('../../../src/utils/crypto.js', () => ({
    encryptString: vi.fn((s) => `enc:${s}`),
    decryptString: vi.fn((s) => s.replace('enc:', '')),
    encryptObject: vi.fn((o) => `encobj:${JSON.stringify(o)}`),
    decryptObject: vi.fn((s) => JSON.parse(s.replace('encobj:', ''))),
}));

vi.mock('../../../src/services/auth.service.js', () => ({
    verifyPassword: vi.fn(),
}));

vi.mock('../../../src/services/twoFactor.service.js', () => ({
    generateTotpSetup: vi.fn(),
    verifyTotpToken: vi.fn(),
    generateBackupCodes: vi.fn(),
    enableTotpForUser: vi.fn(),
    disableTotpForUser: vi.fn(),
    regenerateBackupCodes: vi.fn(),
    getTotpStatus: vi.fn(),
    verifyBackupCode: vi.fn(),
}));

// Mock for dynamic import('otpauth') used in dp2faSetupPost
const mockTotpValidate = vi.fn();
vi.mock('otpauth', () => {
    class MockSecret {
        constructor() {
            this.base32 = 'BASE32SECRET';
        }
        static fromBase32(s) {
            return { base32: s };
        }
    }
    class MockTOTP {
        constructor() {
            this.validate = mockTotpValidate;
        }
    }
    return { TOTP: MockTOTP, Secret: MockSecret };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(overrides = {}) {
    return {
        params: {},
        query: {},
        body: {},
        session: { user: { id: 'user-1', login: 'testuser', email: 'test@example.com', role: 'owner', status: 'active' } },
        ip: '127.0.0.1',
        get: vi.fn(() => 'Mozilla/5.0'),
        __: vi.fn((key) => key),
        ...overrides,
    };
}

function makeRes() {
    return {
        flash: vi.fn(),
        redirect: vi.fn(),
        render: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
}

// ---------------------------------------------------------------------------
// dp2faVerifyGet
// ---------------------------------------------------------------------------

describe('dp2faVerifyGet', () => {
    it('renders the two-factor-verify page with auth layout', () => {
        const req = makeReq();
        const res = makeRes();

        dp2faVerifyGet(req, res);

        expect(res.render).toHaveBeenCalledWith('auth/two-factor-verify', { layout: 'auth' });
    });
});

// ---------------------------------------------------------------------------
// dp2faVerifyPost
// ---------------------------------------------------------------------------

describe('dp2faVerifyPost', () => {
    let req, res;

    const pending = { userId: 'user-1', login: 'testuser', email: 'test@example.com', role: 'owner', status: 'active' };

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq({ body: { totp_code: '123456' }, session: { pending2FA: pending } });
        res = makeRes();
    });

    it('redirects to /dp-login when pending2FA is absent', async () => {
        req.session = {};

        await dp2faVerifyPost(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-login when user not found', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(null);

        await dp2faVerifyPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-login when totp is not enabled', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: false, totp_secret: null, locale: 'fr' });

        await dp2faVerifyPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-2fa-verify when totp_code format is invalid', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_secret: 'enc:SECRET', locale: 'fr' });
        req.body.totp_code = 'abc'; // not 6 digits

        await dp2faVerifyPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_code');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-verify');
    });

    it('flashes error and redirects to /dp-2fa-verify when TOTP code is wrong', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_secret: 'enc:SECRET', locale: 'fr' });
        vi.mocked(verifyTotpToken).mockReturnValue(false);

        await dp2faVerifyPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_code');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-verify');
    });

    it('finalizes the session and redirects to /dashboard when TOTP code is valid', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_secret: 'enc:SECRET', locale: 'fr' });
        vi.mocked(verifyTotpToken).mockReturnValue(true);

        await dp2faVerifyPost(req, res);

        expect(req.session.user).toMatchObject({ id: pending.userId, login: pending.login });
        expect(req.session.pending2FA).toBeUndefined();
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('uses locale from user row when present', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_secret: 'enc:SECRET', locale: 'en' });
        vi.mocked(verifyTotpToken).mockReturnValue(true);

        await dp2faVerifyPost(req, res);

        expect(req.session.user.locale).toBe('en');
    });

    it('defaults locale to fr when user has no locale set', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_secret: 'enc:SECRET', locale: null });
        vi.mocked(verifyTotpToken).mockReturnValue(true);

        await dp2faVerifyPost(req, res);

        expect(req.session.user.locale).toBe('fr');
    });

    it('flashes error and redirects to /dp-2fa-verify on unexpected error', async () => {
        vi.mocked(models.User.findByPk).mockRejectedValue(new Error('DB error'));

        await dp2faVerifyPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_verification_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-verify');
    });
});

// ---------------------------------------------------------------------------
// dp2faRecoveryGet
// ---------------------------------------------------------------------------

describe('dp2faRecoveryGet', () => {
    it('renders the two-factor-recovery page with auth layout', () => {
        const req = makeReq();
        const res = makeRes();

        dp2faRecoveryGet(req, res);

        expect(res.render).toHaveBeenCalledWith('auth/two-factor-recovery', { layout: 'auth' });
    });
});

// ---------------------------------------------------------------------------
// dp2faRecoveryPost
// ---------------------------------------------------------------------------

describe('dp2faRecoveryPost', () => {
    let req, res;

    const pending = { userId: 'user-1', login: 'testuser', email: 'test@example.com', role: 'owner', status: 'active' };

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq({ body: { recovery_code: 'abcd-1234' }, session: { pending2FA: pending } });
        res = makeRes();
    });

    it('redirects to /dp-login when pending2FA is absent', async () => {
        req.session = {};

        await dp2faRecoveryPost(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-login when user not found', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(null);

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-login when TOTP not enabled', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: false, totp_backup_codes: null, locale: 'fr' });

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-login');
    });

    it('flashes error and redirects to /dp-2fa-recovery when recovery_code is empty', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: 'fr' });
        req.body.recovery_code = '   ';

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_recovery');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-recovery');
    });

    it('flashes error and redirects to /dp-2fa-recovery when backup code is invalid', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: 'fr' });
        vi.mocked(verifyBackupCode).mockResolvedValue({ valid: false });

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_recovery');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-recovery');
    });

    it('flashes warning when last backup code is used (remainingCount === 0)', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: 'fr' });
        vi.mocked(verifyBackupCode).mockResolvedValue({ valid: true, updatedEncryptedCodes: 'enc:[]', remainingCount: 0 });
        vi.mocked(models.User.update).mockResolvedValue([1]);

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('warning', 'flash.2fa_last_recovery_used');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes success with remaining count when backup code is valid and codes remain', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: 'fr' });
        vi.mocked(verifyBackupCode).mockResolvedValue({ valid: true, updatedEncryptedCodes: 'enc:[...]', remainingCount: 3 });
        vi.mocked(models.User.update).mockResolvedValue([1]);

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('success', 'flash.2fa_login_remaining');
        expect(req.session.user).toMatchObject({ id: pending.userId });
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('uses locale from user row when present', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: 'en' });
        vi.mocked(verifyBackupCode).mockResolvedValue({ valid: true, updatedEncryptedCodes: 'enc:[...]', remainingCount: 2 });
        vi.mocked(models.User.update).mockResolvedValue([1]);

        await dp2faRecoveryPost(req, res);

        expect(req.session.user.locale).toBe('en');
    });

    it('defaults locale to fr when user has no locale set', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ totp_enabled: true, totp_backup_codes: 'enc:codes', locale: null });
        vi.mocked(verifyBackupCode).mockResolvedValue({ valid: true, updatedEncryptedCodes: 'enc:[...]', remainingCount: 1 });
        vi.mocked(models.User.update).mockResolvedValue([1]);

        await dp2faRecoveryPost(req, res);

        expect(req.session.user.locale).toBe('fr');
    });

    it('flashes error and redirects to /dp-2fa-recovery on unexpected error', async () => {
        vi.mocked(models.User.findByPk).mockRejectedValue(new Error('DB error'));

        await dp2faRecoveryPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_verification_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-recovery');
    });
});

// ---------------------------------------------------------------------------
// dp2faSetupGet
// ---------------------------------------------------------------------------

describe('dp2faSetupGet', () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq();
        res = makeRes();
    });

    it('flashes info and redirects to /dashboard when 2FA is already enabled', async () => {
        vi.mocked(getTotpStatus).mockResolvedValue({ enabled: true, backupCodesRemaining: 3 });

        await dp2faSetupGet(req, res);

        expect(res.flash).toHaveBeenCalledWith('info', 'flash.2fa_already_enabled');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('generates QR code and renders setup page when 2FA not yet enabled', async () => {
        vi.mocked(getTotpStatus).mockResolvedValue({ enabled: false, backupCodesRemaining: 0 });
        vi.mocked(generateTotpSetup).mockResolvedValue({ secret: 'BASE32SECRET', qrCodeDataUrl: 'data:image/png;base64,QR' });

        await dp2faSetupGet(req, res);

        expect(req.session.totp_temp_secret).toBe('BASE32SECRET');
        expect(res.render).toHaveBeenCalledWith('auth/two-factor-setup', {
            layout: 'auth',
            qrCodeDataUrl: 'data:image/png;base64,QR',
            manualKey: 'BASE32SECRET',
        });
    });

    it('flashes error and redirects to /dashboard on unexpected error', async () => {
        vi.mocked(getTotpStatus).mockRejectedValue(new Error('service error'));

        await dp2faSetupGet(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});

// ---------------------------------------------------------------------------
// dp2faSetupPost
// ---------------------------------------------------------------------------

describe('dp2faSetupPost', () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq({
            body: { totp_code: '123456' },
            session: { user: { id: 'user-1', login: 'testuser' }, totp_temp_secret: 'BASE32SECRET' },
        });
        res = makeRes();
        mockTotpValidate.mockReturnValue(0); // valid by default
    });

    it('flashes error and redirects to /dp-2fa-setup when no temp secret in session', async () => {
        req.session.totp_temp_secret = undefined;

        await dp2faSetupPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_session_expired');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-setup');
    });

    it('flashes error and redirects to /dp-2fa-setup when totp_code format is invalid', async () => {
        req.body.totp_code = 'abc12'; // not 6 digits

        await dp2faSetupPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_qr_code');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-setup');
    });

    it('flashes error and redirects to /dp-2fa-setup when TOTP validation returns null', async () => {
        mockTotpValidate.mockReturnValue(null);

        await dp2faSetupPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_qr_code');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-setup');
    });

    it('flashes error and redirects to /dp-2fa-setup when TOTP validation throws', async () => {
        mockTotpValidate.mockImplementation(() => {
            throw new Error('otpauth error');
        });

        await dp2faSetupPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_invalid_qr_code');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-setup');
    });

    it('enables 2FA and redirects to /dp-2fa-backup-codes on valid code', async () => {
        vi.mocked(generateBackupCodes).mockResolvedValue({ plainCodes: ['abcd-1234'], hashedCodes: ['hashed'] });
        vi.mocked(enableTotpForUser).mockResolvedValue(true);

        await dp2faSetupPost(req, res);

        expect(enableTotpForUser).toHaveBeenCalledWith('user-1', 'BASE32SECRET', ['hashed']);
        expect(req.session.totp_backup_codes_plain).toEqual(['abcd-1234']);
        expect(req.session.totp_temp_secret).toBeUndefined();
        expect(res.flash).toHaveBeenCalledWith('success', 'flash.2fa_enabled');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-backup-codes');
    });

    it('flashes error and redirects to /dp-2fa-setup when enableTotpForUser throws', async () => {
        vi.mocked(generateBackupCodes).mockResolvedValue({ plainCodes: [], hashedCodes: [] });
        vi.mocked(enableTotpForUser).mockRejectedValue(new Error('DB error'));

        await dp2faSetupPost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_enable_error');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-setup');
    });
});

// ---------------------------------------------------------------------------
// dp2faBackupCodesGet
// ---------------------------------------------------------------------------

describe('dp2faBackupCodesGet', () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        res = makeRes();
    });

    it('redirects to /dashboard when no backup codes in session', () => {
        req = makeReq({ session: { user: { id: 'user-1' } } });

        dp2faBackupCodesGet(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to /dashboard when backup codes array is empty', () => {
        req = makeReq({ session: { user: { id: 'user-1' }, totp_backup_codes_plain: [] } });

        dp2faBackupCodesGet(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('renders backup codes page and deletes codes from session', () => {
        const codes = ['abcd-1234', 'efgh-5678'];
        req = makeReq({ session: { user: { id: 'user-1' }, totp_backup_codes_plain: codes } });

        dp2faBackupCodesGet(req, res);

        expect(res.render).toHaveBeenCalledWith('auth/two-factor-backup-codes', { layout: 'auth', backupCodes: codes });
        expect(req.session.totp_backup_codes_plain).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// dp2faDisablePost
// ---------------------------------------------------------------------------

describe('dp2faDisablePost', () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq({ body: { password: 'correct-password' } });
        res = makeRes();
    });

    it('flashes error and redirects to /dashboard when user not found', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(null);

        await dp2faDisablePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes error and redirects to /dashboard when password is wrong', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ id: 'user-1', password: 'hashed' });
        vi.mocked(verifyPassword).mockResolvedValue(false);

        await dp2faDisablePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.wrong_password');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('disables 2FA and redirects to /dashboard when password is correct', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ id: 'user-1', password: 'hashed' });
        vi.mocked(verifyPassword).mockResolvedValue(true);
        vi.mocked(disableTotpForUser).mockResolvedValue(true);

        await dp2faDisablePost(req, res);

        expect(disableTotpForUser).toHaveBeenCalledWith('user-1');
        expect(res.flash).toHaveBeenCalledWith('success', 'flash.2fa_disabled');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes error and redirects to /dashboard on unexpected error', async () => {
        vi.mocked(models.User.findByPk).mockRejectedValue(new Error('DB error'));

        await dp2faDisablePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_disable_error');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});

// ---------------------------------------------------------------------------
// dp2faRegeneratePost
// ---------------------------------------------------------------------------

describe('dp2faRegeneratePost', () => {
    let req, res;

    beforeEach(() => {
        vi.clearAllMocks();
        req = makeReq({ body: { password: 'correct-password' } });
        res = makeRes();
    });

    it('flashes error and redirects to /dashboard when user not found', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue(null);

        await dp2faRegeneratePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_config_error');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('flashes error and redirects to /dashboard when password is wrong', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ id: 'user-1', password: 'hashed' });
        vi.mocked(verifyPassword).mockResolvedValue(false);

        await dp2faRegeneratePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.wrong_password');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('regenerates backup codes and redirects to /dp-2fa-backup-codes on success', async () => {
        vi.mocked(models.User.findByPk).mockResolvedValue({ id: 'user-1', password: 'hashed' });
        vi.mocked(verifyPassword).mockResolvedValue(true);
        vi.mocked(regenerateBackupCodes).mockResolvedValue({ plainCodes: ['new-code-1', 'new-code-2'] });

        await dp2faRegeneratePost(req, res);

        expect(regenerateBackupCodes).toHaveBeenCalledWith('user-1');
        expect(req.session.totp_backup_codes_plain).toEqual(['new-code-1', 'new-code-2']);
        expect(res.flash).toHaveBeenCalledWith('success', 'flash.2fa_codes_regenerated');
        expect(res.redirect).toHaveBeenCalledWith('/dp-2fa-backup-codes');
    });

    it('flashes error and redirects to /dashboard on unexpected error', async () => {
        vi.mocked(models.User.findByPk).mockRejectedValue(new Error('DB error'));

        await dp2faRegeneratePost(req, res);

        expect(res.flash).toHaveBeenCalledWith('error', 'flash.2fa_codes_regen_error');
        expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
});
