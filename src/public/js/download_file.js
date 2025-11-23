/**
 * Download File - Individual file download feedback
 * Adds visual feedback when clicking on a file card to download it
 */
(function () {
    'use strict';

    /**
     * Initialize download feedback for all file cards
     */
    function initDownloadFeedback() {
        const downloadLinks = document.querySelectorAll('[data-download-link]');

        downloadLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                const card = this;
                const indicator = card.querySelector('.download-indicator');
                const iconContainer = indicator?.querySelector('div');

                if (indicator && iconContainer) {
                    // Show the download indicator
                    indicator.classList.remove('opacity-0');
                    indicator.classList.add('opacity-100');
                    iconContainer.classList.remove('scale-0');
                    iconContainer.classList.add('scale-100');

                    // Add a pulse effect to the card
                    card.classList.add('ring-2', 'ring-success');

                    // Hide after animation (1200ms)
                    setTimeout(() => {
                        indicator.classList.remove('opacity-100');
                        indicator.classList.add('opacity-0');
                        iconContainer.classList.remove('scale-100');
                        iconContainer.classList.add('scale-0');
                        card.classList.remove('ring-2', 'ring-success');
                    }, 1200);
                }
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDownloadFeedback);
    } else {
        initDownloadFeedback();
    }
})();
