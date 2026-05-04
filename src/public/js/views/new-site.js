(function () {
    if (window.__newSiteInit) return;
    window.__newSiteInit = true;

    try {
        const modal = document.getElementById('my_modal_new_site');
        const form = document.getElementById('fromCreateSite');
        const input = form ? form.querySelector('input[name="domain"]') : modal ? modal.querySelector('input[name="domain"]') : null;
        const submit = document.getElementById('btnCreateSite');
        const msg = document.getElementById('create_site_msg');
        if (!input || !submit) return;

        const gatherDomains = () => {
            return Array.from(document.querySelectorAll('.dash-site')).map((el) => (el.getAttribute('domain') || '').trim());
        };

        const checkDuplicate = () => {
            const val = (input.value || '').trim();
            if (!val) {
                submit.disabled = false;
                if (msg) msg.classList.add('hidden');
                return;
            }
            const domains = gatherDomains();
            const exists = domains.includes(val);
            submit.disabled = !!exists;
            if (msg) {
                if (exists) msg.classList.remove('hidden');
                else msg.classList.add('hidden');
            }
        };

        input.addEventListener('input', () => {
            // Supprime les espaces saisis par l'utilisateur
            const cleaned = (input.value || '').replace(/\s+/g, '');
            if (input.value !== cleaned) {
                input.value = cleaned;
            }
            checkDuplicate();
        });

        // Vérification initiale
        checkDuplicate();

        // Observe les changements de la liste des sites
        const anySite = document.querySelector('.dash-site');
        if (anySite && window.MutationObserver) {
            const parent = anySite.parentElement || document.body;
            const mo = new MutationObserver(() => checkDuplicate());
            mo.observe(parent, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['domain'],
            });
        } else if (window.MutationObserver) {
            const mo = new MutationObserver(() => checkDuplicate());
            mo.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['domain'],
            });
        }
    } catch (e) {
        // silent
    }
})();
