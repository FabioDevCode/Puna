/**
 * Export Excel - Export form data to Excel
 * Handles the export button click and triggers download
 */
(function () {
    'use strict';

    /**
     * Initialize Excel export functionality
     */
    function initExcelExport() {
        const exportBtn = document.getElementById('exportExcelBtn');

        if (!exportBtn) {
            return; // Button not present on this page
        }

        exportBtn.addEventListener('click', function () {
            // Get the active form ID from the active tab
            const activeTab = document.querySelector('.tab.tab-active');

            if (!activeTab) {
                console.warn('No active form selected');
                return;
            }

            const formId = activeTab.getAttribute('data-id');

            if (!formId) {
                console.error('Form ID not found on active tab');
                return;
            }

            // Disable button during download
            exportBtn.disabled = true;
            const originalContent = exportBtn.innerHTML;
            exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="hidden md:flex">Export...</span>';

            // Create hidden iframe to trigger download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/form/${formId}/export-excel`;
            iframe.setAttribute('data-temp-export', 'true');
            document.body.appendChild(iframe);

            // Re-enable button after a delay
            setTimeout(() => {
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalContent;

                // Clean up iframe
                const tempIframes = document.querySelectorAll('iframe[data-temp-export]');
                tempIframes.forEach(frame => {
                    if (frame.parentNode) {
                        frame.parentNode.removeChild(frame);
                    }
                });
            }, 2000);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExcelExport);
    } else {
        initExcelExport();
    }
})();
