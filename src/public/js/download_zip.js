/**
 * Download ZIP - Download all files as ZIP archive
 * Uses fetch + Blob to avoid CSP frame-src restrictions
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

            try {
                const response = await fetch(`/inbox/${inboxId}/download-zip`);

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                // Extract filename from Content-Disposition header if present
                const disposition = response.headers.get('Content-Disposition');
                let filename = `inbox_${inboxId}_documents.zip`;
                if (disposition) {
                    const match = disposition.match(/filename="?([^";\n]+)"?/i);
                    if (match) filename = match[1];
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error('ZIP download error:', err);
            } finally {
                try {
                    modal.close();
                } catch (err) {
                    console.error('Error closing modal:', err);
                }
            }
        });
    }

    /**
     * Auto-initialize all buttons with data-zip-download attribute
     */
    function autoInitialize() {
        const buttons = document.querySelectorAll('[data-zip-download]');

        buttons.forEach((button) => {
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
