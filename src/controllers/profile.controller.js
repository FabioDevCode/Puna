import { getUserById, updateUserLocale } from '../services/user.service.js';

export const profilePage = async (req, res) => {
    const userId = req.session.user?.id;
    try {
        const user = await getUserById(userId);
        res.render('profile/index', { user });
    } catch (_err) {
        res.redirect('/dashboard');
    }
};

export const updateLocale = async (req, res) => {
    const userId = req.session.user?.id;
    const { locale } = req.body;

    if (!['fr', 'en'].includes(locale)) {
        res.flash('error', res.__('profile.invalid_locale'));
        return res.redirect('/profile');
    }

    try {
        await updateUserLocale(userId, locale);
        req.session.user.locale = locale;
        // Persister la langue dans le cookie "lang" lu par i18n.init
        // Ainsi les pages hors session (login, mot de passe oublié...) seront déjà traduites
        res.cookie('lang', locale, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
        });
        res.flash('success', res.__('profile.locale_updated'));
        return res.redirect('/profile');
    } catch (_err) {
        res.flash('error', res.__('profile.update_error'));
        return res.redirect('/profile');
    }
};
