(function () {
    /**
     * Initialise la logique de confirmation de suppression de site.
     * Le dialog doit porter :
     *   data-component="delete-site"
     *   data-site-id="<id>"
     *   data-expected-domain="<domain>"
     */
    function initDeleteSiteModal(dialog) {
        const siteId = dialog.dataset.siteId;
        const expectedDomain = dialog.dataset.expectedDomain;
        if (!siteId || !expectedDomain) return;

        const input = document.getElementById('confirm_domain_' + siteId);
        const btn = document.getElementById('btnConfirmDelete_' + siteId);
        if (!input || !btn) return;

        btn.disabled = true;
        input.addEventListener('input', function (e) {
            const v = (e.target.value || '').trim();
            btn.disabled = v !== expectedDomain;
        });
    }

    try {
        document.querySelectorAll('dialog[data-component="delete-site"]').forEach(initDeleteSiteModal);
    } catch (_e) {
        // silent
    }
})();
