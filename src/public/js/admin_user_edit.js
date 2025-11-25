document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('roleSelect');
    const clearPasswordBtn = document.getElementById('clearPasswordBtn');
    const disableUserBtn = document.getElementById('disableUserBtn');
    const passwordDisplay = document.getElementById('passwordDisplay');
    const clearPasswordField = document.getElementById('clear_password_field');
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
                siteCheckboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });

                // Afficher une notification visuelle
                const container = sitesListContainer.parentElement;
                const notice = document.createElement('div');
                notice.className = 'alert alert-info alert-sm mt-2';
                notice.innerHTML = '<i class="fa-solid fa-info-circle mr-2"></i>Les sites ont été désélectionnés suite au changement de rôle';
                container.appendChild(notice);

                setTimeout(() => notice.remove(), 3000);
            }
        });
    }

    // Vider le mot de passe
    if (clearPasswordBtn) {
        clearPasswordBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir vider le mot de passe ? Cela désactivera automatiquement l\'utilisateur.')) {
                passwordDisplay.value = '';
                clearPasswordField.value = 'true';

                // Changer visuellement le bouton
                clearPasswordBtn.classList.remove('btn-outline');
                clearPasswordBtn.classList.add('btn-warning');
                clearPasswordBtn.innerHTML = '<i class="fa-solid fa-check"></i> Mot de passe vidé';
                clearPasswordBtn.disabled = true;

                // Afficher un avertissement
                const form = clearPasswordBtn.closest('form');
                const warning = document.createElement('div');
                warning.className = 'alert alert-warning mt-4';
                warning.innerHTML = '<i class="fa-solid fa-exclamation-triangle mr-2"></i>L\'utilisateur sera désactivé lors de l\'enregistrement';
                form.insertBefore(warning, form.querySelector('.flex.justify-end'));
            }
        });
    }

    // Bouton désactiver utilisateur
    if (disableUserBtn) {
        disableUserBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
                // On vide le mot de passe, ce qui désactivera l'utilisateur
                clearPasswordField.value = 'true';

                // Submit le formulaire
                disableUserBtn.closest('form').submit();
            }
        });
    }

    // Recherche de sites
    if (siteSearchInput && sitesListContainer) {
        siteSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const labels = sitesListContainer.querySelectorAll('label');
            let visibleCount = 0;

            labels.forEach(label => {
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
