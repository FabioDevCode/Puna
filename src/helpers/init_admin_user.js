import models from '../models/index.js';

export const initAdminUSer = async () => {
    try {
        const count = await models.User.count();
        if (count === 0) {
            await models.User.create({
                email: '',
                login: 'admin',
                role: 'super_admin',
                status: 'pending',
                enabled: false
            });
        }
    } catch (err) {
        console.error(err);
    }
};
