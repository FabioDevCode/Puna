import models from "../models/index.js";

export const initAdminUSer = async() => {
    try {
        const count = await models.User.count();
        if(count === 0) {
            await models.User.create({
                email: "contact@fabiolopes.fr",
                login: "fabio",
                enabled: false
            });
        }
    } catch (err) {
        console.error(err);
    }
};