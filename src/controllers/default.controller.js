import models from '../models/index.js';
import bcrypt from 'bcrypt';

export const dashboard = (req, res) => {
    res.render('dashboard');
};

export const error = async(req, res) => {
    res.render('error', {
        layout: false
    })
};

export const dpLogin = (req, res) => {
    res.render('login', {
        layout: "login"
    })
};

export const dpFirstCo = (req, res) => {
    res.render('first_co', {
        layout: "login"
    })
};

export const dpFirstCoPost = async (req, res) => {
    const { login, password, confirm_password } = req.body;
    // Vérifier si le login existe
    const user = await models.User.findOne({
        where: {
            login,
            enabled: false
        }
    });
    if (!user) {
        return res.render('first_co', {
            layout: "login",
            error: "Login inconnu."
        });
    }
    // Vérifier que les deux mots de passe sont identiques
    if (password !== confirm_password) {
        return res.render('first_co', {
            layout: "login",
            error: "Les mots de passe ne correspondent pas."
        });
    }
    // Générer le hash du mot de passe
    const saltRounds = 10;

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        await user.update({ password: hash, enabled: true });
        return res.redirect('/dp-login');
    } catch (err) {
        return res.render('first_co', {
            layout: "login",
            error: "Erreur lors de la mise à jour du mot de passe."
        });
    }
};

export const dpConnect = async (req, res) => {
    const { login, password } = req.body;
    try {
        const user = await models.User.findOne({
            where: {
                login,
                enabled: true
            }
        });

        if (!user) {
            throw new Error('Utilisateur non trouvé ou non activé.');
        }
        // Vérifier le mot de passe
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw new Error('Mot de passe incorrect.');
        }

        res.redirect('/dashboard');
    } catch (err) {
        res.redirect('/error');
    }
};


