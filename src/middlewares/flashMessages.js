/**
 * Middleware pour gérer les flash messages
 * Permet d'ajouter des messages dans la session qui seront affichés une seule fois
 */

/**
 * Initialise le système de flash messages
 * Ajoute la méthode res.flash() et injecte les messages dans res.locals
 */
function flashMessages(req, res, next) {
    // Initialiser le tableau de messages s'il n'existe pas
    if (!req.session.flashMessages) {
        req.session.flashMessages = [];
    }

    /**
     * Ajoute un message flash à la session
     * @param {string} type - Type de toast: 'puna', 'info', 'success', 'warning', 'error'
     * @param {string} text - Texte du message
     */
    res.flash = function (type, text) {
        const validTypes = ['puna', 'info', 'success', 'warning', 'error'];
        if (!validTypes.includes(type)) {
            type = 'info';
        }
        if (typeof text !== 'string' || text.length === 0) {
            return;
        }
        if (text.length > 200) {
            text = text.substring(0, 200) + '...';
        }
        req.session.flashMessages.push({ type, text });
    };

    // Injecter les messages dans res.locals pour les rendre disponibles dans les vues
    res.locals.flashMessages = req.session.flashMessages || [];

    // Vider les messages après les avoir injectés
    req.session.flashMessages = [];

    next();
}

export default flashMessages;
