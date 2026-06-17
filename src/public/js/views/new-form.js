(function () {
    /**
     * Initialise la logique de validation anti-doublon pour un dialog de création de formulaire.
     * Le dialog doit porter l'attribut data-component="new-form" et data-site-id="<id>".
     */
    function initNewFormModal(dialog) {
        const siteId = dialog.dataset.siteId;
        if (!siteId) return;

        const input = dialog.querySelector('input[name="name"]');
        const submit = document.getElementById('btnCreateForm_' + siteId);
        const msg = document.getElementById('create_form_msg_' + siteId);
        if (!input || !submit) return;

        const gatherNames = () => {
            return Array.from(document.querySelectorAll('.tabs [data-name]')).map((el) => (el.getAttribute('data-name') || '').trim());
        };

        const checkDuplicate = () => {
            const val = (input.value || '').trim();
            if (!val) {
                submit.disabled = false;
                if (msg) msg.classList.add('hidden');
                return;
            }
            const names = gatherNames();
            const exists = names.includes(val);
            submit.disabled = !!exists;
            if (msg) {
                if (exists) msg.classList.remove('hidden');
                else msg.classList.add('hidden');
            }
        };

        input.addEventListener('input', checkDuplicate);
        // Vérification initiale (cas où le champ serait pré-rempli)
        checkDuplicate();

        // Observe la zone des onglets pour détecter les changements dynamiques
        const tabsContainer = document.querySelector('.tabs');
        if (tabsContainer && window.MutationObserver) {
            const mo = new MutationObserver(() => checkDuplicate());
            mo.observe(tabsContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-name'],
            });
        }
    }

    try {
        document.querySelectorAll('dialog[data-component="new-form"]').forEach(initNewFormModal);
    } catch (_e) {
        // silent
    }
})();
