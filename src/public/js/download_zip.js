/**
 * Download ZIP - Download all files as ZIP archive
 * Handles the modal and iframe download mechanism
 */
(function () {
    'use strict';

    /**
     * Initialize ZIP download functionality
     * @param {string} btnId - Button element ID
     * @param {string} modalId - Modal element ID
     * @param {string} inboxId - Inbox ID for the download URL
     */
    function initZipDownload(btnId, modalId, inboxId) {
        const btnDownloadZip = document.getElementById(btnId);
        const modal = document.getElementById(modalId);

        if (!btnDownloadZip || !modal) {
            console.warn(`ZIP download: Button (${btnId}) or modal (${modalId}) not found`);
            return;
        }

        btnDownloadZip.addEventListener('click', async (e) => {
            e.preventDefault();

            // Show loading modal
            try {
                modal.showModal();
            } catch (err) {
                console.error('Error showing modal:', err);
                return;
            }

            // Create a hidden iframe to trigger download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/inbox/${inboxId}/download-zip`;
            iframe.setAttribute('data-temp-download', 'true');
            document.body.appendChild(iframe);

            // Close modal after download starts (1 second)
            setTimeout(() => {
                try {
                    modal.close();
                    // Clean up iframe
                    const tempIframes = document.querySelectorAll('iframe[data-temp-download]');
                    tempIframes.forEach(frame => {
                        if (frame.parentNode) {
                            frame.parentNode.removeChild(frame);
                        }
                    });
                } catch (err) {
                    console.error('Error closing modal:', err);
                }
            }, 1000);
        });
    }

    /**
     * Auto-initialize all buttons with data-zip-download attribute
     */
    function autoInitialize() {
        const buttons = document.querySelectorAll('[data-zip-download]');

        buttons.forEach(button => {
            const inboxId = button.getAttribute('data-inbox-id');
            const modalId = button.getAttribute('data-modal-id');
            const btnId = button.id;

            if (inboxId && modalId && btnId) {
                initZipDownload(btnId, modalId, inboxId);
            } else {
                console.warn('ZIP download button missing required data attributes:', button);
            }
        });
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInitialize);
    } else {
        autoInitialize();
    }

    // Expose to global scope for manual initialization if needed
    window.PunaDownload = window.PunaDownload || {};
    window.PunaDownload.initZipDownload = initZipDownload;
    window.PunaDownload.autoInitializeZip = autoInitialize;
})();
