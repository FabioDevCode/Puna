/**
 * Puna - Core Utilities
 * Fonctions utilitaires partagées entre les scripts front-end
 *
 * Usage: Les fonctions sont exposées globalement via window.PunaUtils
 * Exemple: PunaUtils.escapeHtml('<script>')
 */

(function () {
    'use strict';

    const PunaUtils = {
        /**
         * Ajoute un zéro devant les nombres < 10
         * @param {number} n - Nombre à formater
         * @returns {string} Nombre avec padding
         */
        pad2(n) {
            return String(n).padStart(2, '0');
        },

        /**
         * Échappe les caractères HTML pour prévenir les injections XSS
         * @param {string} str - Chaîne à échapper
         * @returns {string} Chaîne échappée
         */
        escapeHtml(str) {
            return String(str).replace(
                /[&<>"'`]/g,
                (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#x60;' })[s]
            );
        },

        /**
         * Formate une date en HTML (YYYY-MM-DD HH:MM:SS)
         * Retourne un élément HTML avec date et heure séparés
         * @param {Date|string|number} value - Valeur à formater
         * @returns {string} HTML formaté ou ' - ' si invalide
         */
        formatDateTime(value) {
            if (!value && value !== 0) {
                return ' - ';
            }
            try {
                const d = value instanceof Date ? value : new Date(value);
                if (Number.isNaN(d.getTime())) {
                    return String(value);
                }
                return `
                    <div class="flex flex-wrap gap-1">
                        <p class="w-max">${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}&nbsp;</p>
                        <p class="w-max">${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}:${this.pad2(d.getSeconds())}</p>
                    </div>
                `;
            } catch (e) {
                return String(value);
            }
        },

        /**
         * Formate une date en YYYY-MM-DD (pour input[type=date])
         * @param {Date|string|number} value - Valeur à formater
         * @returns {string} Date formatée ou chaîne vide si invalide
         */
        formatDateYYYYMMDD(value) {
            if (!value && value !== 0) {
                return '';
            }
            try {
                const d = value instanceof Date ? value : new Date(value);
                if (Number.isNaN(d.getTime())) {
                    return String(value);
                }
                return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
            } catch (e) {
                return String(value);
            }
        },

        /**
         * Formate un timestamp en HH:MM:SS (format français)
         * @param {number} timestamp - Timestamp en millisecondes
         * @returns {string} Heure formatée ou '-' si invalide
         */
        formatTime(timestamp) {
            if (!timestamp) {
                return '-';
            }
            const date = new Date(timestamp);
            return date.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        },
    };

    // Expose globalement
    window.PunaUtils = PunaUtils;
})();
