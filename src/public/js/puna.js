/**
 * Affiche une notification toast
 * @param {Object} options - Options de la notification
 * @param {string} options.text - Texte à afficher
 * @param {string} [options.type='puna'] - Type de notification: 'puna', 'info', 'success', 'warning', 'error'
 */
function Toast({ text, type = 'puna' }) {
    Toastify({
        text,
        duration: 3000,
        className: type,
        newWindow: true,
        close: false,
        gravity: 'bottom',
        position: 'right',
        stopOnFocus: true,
    }).showToast();
}

// Exemple ----
// Toast({
//     text: 'Bienvenu sur puna',
//     type: 'puna',
// });

// Expose la fonction globalement
window.Toast = Toast;
