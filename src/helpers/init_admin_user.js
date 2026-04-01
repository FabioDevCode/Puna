import { logger, errorLogger } from '../config/logger.js';
import models from '../models/index.js';

export const initAdminUser = async () => {
    try {
        const count = await models.User.count();
        if (count === 0) {
            const login = process.env.ADMIN_LOGIN;
            if (!login) {
                errorLogger.error('ADMIN_LOGIN environment variable is required on first startup (no users in database)');
                process.exit(1);
            }
            await models.User.create({
                email: process.env.ADMIN_EMAIL || '',
                login,
                role: 'super_admin',
                status: 'pending',
                enabled: false,
                created_by: null,
            });
            logger.info(`Admin user "${login}" created with status "pending"`);
        }
    } catch (err) {
        errorLogger.error({ err }, 'initAdminUser error');
    }
};
