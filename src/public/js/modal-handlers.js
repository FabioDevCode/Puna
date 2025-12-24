/**
 * Gestionnaire centralisé pour les modales
 * Remplace les onclick inline pour respecter la CSP (Content Security Policy)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // OUVERTURE DE MODALES (data-open-modal)
    // ============================================

    // Délégation d'événement pour tous les boutons avec data-open-modal
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-open-modal]');
        if (target) {
            const modalId = target.getAttribute('data-open-modal');
            const modal = document.getElementById(modalId);
            if (modal && typeof modal.showModal === 'function') {
                modal.showModal();
            }
        }
    });

    // ============================================
    // FERMETURE DE MODALES (data-close-modal)
    // ============================================

    // Délégation d'événement pour tous les boutons avec data-close-modal
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-close-modal]');
        if (target) {
            const modalId = target.getAttribute('data-close-modal');
            const modal = document.getElementById(modalId);
            if (modal && typeof modal.close === 'function') {
                modal.close();
            }
        }
    });

    // ============================================
    // BOUTONS SPÉCIFIQUES PAR ID
    // ============================================

    // Bouton "Template" (form-template.hbs)
    const btnOpenTemplate = document.getElementById('btn_open_template');
    if (btnOpenTemplate) {
        btnOpenTemplate.addEventListener('click', () => {
            const modal = document.getElementById('modal_form_template');
            if (modal) {
                modal.showModal();
            }
        });
    }

    // Bouton "Supprimer ce formulaire" (delete-form.hbs)
    const btnDeleteForm = document.getElementById('btn_delete_form');
    if (btnDeleteForm) {
        btnDeleteForm.addEventListener('click', () => {
            const modal = document.getElementById('modal_delete_form');
            if (modal) {
                modal.showModal();
            }
        });
    }

    // Bouton "Nouveau site" (new-site.hbs)
    const btnNewSite = document.getElementById('btn-new-site');
    if (btnNewSite) {
        btnNewSite.addEventListener('click', () => {
            const modal = document.getElementById('my_modal_new_site');
            if (modal) {
                modal.showModal();
            }
        });
    }

    // Bouton "Créer un utilisateur" (admin/users/list.hbs)
    const btnCreateUser = document.getElementById('btn-create-user');
    if (btnCreateUser) {
        btnCreateUser.addEventListener('click', () => {
            const modal = document.getElementById('createUserModal');
            if (modal) {
                modal.showModal();
            }
        });
    }

    // Bouton de recherche (site-search.hbs)
    const openSearchBtn = document.getElementById('open-search-btn');
    if (openSearchBtn) {
        openSearchBtn.addEventListener('click', () => {
            if (typeof openSearchModal === 'function') {
                // eslint-disable-next-line no-undef
                openSearchModal();
            }
        });
    }
});
