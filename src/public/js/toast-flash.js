/**
 * Script pour afficher automatiquement les flash messages sous forme de toasts
 * Détecte les messages injectés dans la page et les affiche au chargement
 */

(function () {
    // Récupérer les messages depuis l'attribut data-flash-messages
    const flashContainer = document.getElementById('flash-messages');

    if (!flashContainer) {
        return;
    }

    const messagesJson = flashContainer.getAttribute('data-flash-messages');

    if (!messagesJson) {
        return;
    }

    try {
        const messages = JSON.parse(messagesJson);

        // Afficher chaque message avec un délai progressif pour éviter le chevauchement
        messages.forEach((message, index) => {
            setTimeout(() => {
                Toast({
                    text: message.text,
                    type: message.type,
                });
            }, index * 300); // Délai de 300ms entre chaque toast
        });
    } catch (error) {
        console.error('Erreur lors du parsing des flash messages:', error);
    }
})();
