document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('roleSelect');
    const siteCheckboxes = document.querySelectorAll('.site-checkbox');
    const siteSearchInput = document.getElementById('siteSearchInput');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const noSiteFound = document.getElementById('noSiteFound');

    let initialRole = roleSelect ? roleSelect.value : null;

    // Désélectionner tous les sites quand le rôle change
    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value !== initialRole) {
                // Désélectionner tous les sites
                siteCheckboxes.forEach((checkbox) => {
                    checkbox.checked = false;
                });

                // Afficher une notification visuelle
                const container = sitesListContainer.parentElement;
                const notice = document.createElement('div');
                notice.className = 'alert alert-info alert-sm mt-2';
                notice.innerHTML = `<i class="fa-solid fa-info-circle mr-2"></i>${(window.__i18n && window.__i18n.sites_deselected_role_change) || 'Les sites ont été désélectionnés suite au changement de rôle'}`;
                container.appendChild(notice);

                setTimeout(() => notice.remove(), 3000);
            }
        });
    }

    // Recherche de sites
    if (siteSearchInput && sitesListContainer) {
        siteSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const labels = sitesListContainer.querySelectorAll('label');
            let visibleCount = 0;

            labels.forEach((label) => {
                const text = label.querySelector('.label-text')?.textContent.toLowerCase();
                if (text && text.includes(term)) {
                    label.classList.remove('hidden');
                    visibleCount++;
                } else {
                    label.classList.add('hidden');
                }
            });

            // Afficher message si aucun résultat
            if (noSiteFound) {
                if (visibleCount === 0 && labels.length > 0) {
                    noSiteFound.classList.remove('hidden');
                } else {
                    noSiteFound.classList.add('hidden');
                }
            }
        });
    }
});
