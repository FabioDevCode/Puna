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
        res.flash('success', res.__('profile.locale_updated'));
        return res.redirect('/profile');
    } catch (_err) {
        res.flash('error', res.__('profile.update_error'));
        return res.redirect('/profile');
    }
};
