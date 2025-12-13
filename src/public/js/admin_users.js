document.addEventListener('DOMContentLoaded', () => {
    // État de la page
    const state = {
        limit: 10,
        offset: 0,
        total: 0,
        search: '',
        searchField: 'auto', // Nouveau: champ de recherche sélectionné
        isLoading: false,
    };

    // Éléments du DOM
    const elements = {
        tableBody: document.getElementById('users_table_body'),
        loading: document.getElementById('loading_users'),
        noData: document.getElementById('no_users'),
        tableContainer: document.getElementById('tableUsers'),
        limitSelect: document.getElementById('numLignTable'),
        countLabel: document.getElementById('count_users'),
        prevBtn: document.getElementById('prevPage'),
        nextBtn: document.getElementById('nextPage'),
        currentBtn: document.getElementById('currentPage'),
        exportBtn: document.getElementById('exportExcelBtn'),
        exportCSVBtn: document.getElementById('exportCSVBtn'),
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearch'),
        searchFieldSelect: document.getElementById('searchFieldSelect'), // Nouveau
    };

    // Initialisation
    init();

    function init() {
        // Event listeners
        elements.limitSelect.addEventListener('change', handleLimitChange);
        elements.prevBtn.addEventListener('click', () => handlePageChange(-1));
        elements.nextBtn.addEventListener('click', () => handlePageChange(1));
        elements.exportBtn.addEventListener('click', handleExport);
        elements.exportCSVBtn?.addEventListener('click', handleExportCSV);

        // Event listener pour le sélecteur de champ
        elements.searchFieldSelect.addEventListener('change', handleSearchFieldChange);

        // Setup recherche
        setupSearch();

        // Setup recherche sites (modal)
        setupSiteSearch();

        // Setup modal de suppression
        setupDeleteModal();

        // Chargement initial
        loadUsers();
    }

    function setupDeleteModal() {
        const modal = document.getElementById('modal_delete_user');
        const form = document.getElementById('formDeleteUser');
        const passwordInput = document.getElementById('delete_user_password');
        const confirmBtn = document.getElementById('confirmDeleteUserBtn');
        const userIdInput = document.getElementById('user_delete_id');
        const userLoginSpan = document.getElementById('delete_user_login');

        if (!modal || !passwordInput || !confirmBtn) {
            return;
        }

        // Activer/désactiver le bouton selon le mot de passe
        passwordInput.addEventListener('input', (e) => {
            confirmBtn.disabled = e.target.value.trim() === '';
        });

        // Reset lors de la fermeture
        modal.addEventListener('close', () => {
            passwordInput.value = '';
            confirmBtn.disabled = true;
            form.reset();
        });

        // Fonction globale pour ouvrir la modal (appelée depuis les boutons)
        window.openDeleteUserModal = (userId, userLogin) => {
            userIdInput.value = userId;
            userLoginSpan.textContent = userLogin;
            form.action = '/admin/users/delete';
            modal.showModal();
        };
    }

    function setupSiteSearch() {
        const input = document.getElementById('siteSearchInput');
        const container = document.getElementById('sitesListContainer');
        const noResult = document.getElementById('noSiteFound');

        if (!input || !container) {
            return;
        }

        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const labels = container.querySelectorAll('label');
            let visibleCount = 0;

            labels.forEach((label) => {
                const text = label.querySelector('.label-text').textContent.toLowerCase();
                if (text.includes(term)) {
                    label.classList.remove('hidden');
                    visibleCount++;
                } else {
                    label.classList.add('hidden');
                }
            });

            // Afficher message si aucun résultat
            if (noResult) {
                if (visibleCount === 0 && labels.length > 0) {
                    noResult.classList.remove('hidden');
                } else {
                    noResult.classList.add('hidden');
                }
            }
        });
    }

    function setupSearch() {
        let debounceTimer;

        elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const val = e.target.value.trim();

            // Afficher/masquer croix
            elements.clearSearchBtn.classList.toggle('hidden', val === '');

            debounceTimer = setTimeout(() => {
                state.search = val;
                state.offset = 0; // Retour première page
                loadUsers();
            }, 500);
        });

        elements.clearSearchBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.search = '';
            state.offset = 0;
            elements.clearSearchBtn.classList.add('hidden');
            loadUsers();
            elements.searchInput.focus();
        });
    }

    async function loadUsers() {
        if (state.isLoading) {
            return;
        }
        state.isLoading = true;

        // UI Loading
        elements.tableBody.innerHTML = '';
        elements.loading.classList.remove('none');
        elements.noData.classList.add('none');
        elements.tableContainer.classList.add('opacity-50');

        try {
            const params = new URLSearchParams({
                limit: state.limit,
                offset: state.offset,
                search: state.search,
                searchField: state.searchField,
            });

            const response = await fetch(`/admin/users/list?${params}`);
            if (!response.ok) {
                throw new Error('Erreur réseau');
            }

            const data = await response.json();

            state.total = data.total;
            renderTable(data.users);
            updatePagination();
        } catch (error) {
            console.error('Erreur chargement users:', error);
            // Afficher erreur dans le tableau ?
        } finally {
            state.isLoading = false;
            elements.loading.classList.add('none');
            elements.tableContainer.classList.remove('opacity-50');
        }
    }

    function renderTable(users) {
        elements.tableBody.innerHTML = '';

        if (users.length === 0) {
            elements.noData.classList.remove('none');
            return;
        }

        const fragment = document.createDocumentFragment();

        users.forEach((user) => {
            const tr = document.createElement('tr');
            // tr.className = 'hover';

            // Badge rôle
            let roleBadge = '';
            switch (user.role) {
                case 'super_admin':
                    roleBadge =
                        '<span class="badge badge-outline badge_role badge_super_admin badge-sm">Super Admin</span>';
                    break;
                case 'owner':
                    roleBadge = '<span class="badge badge-outline badge_role badge_owner badge-sm">Owner</span>';
                    break;
                case 'editor':
                    roleBadge = '<span class="badge badge-outline badge_role badge_editor badge-sm">Editor</span>';
                    break;
                case 'viewer':
                    roleBadge = '<span class="badge badge-outline badge_role badge_viewer badge-sm">Viewer</span>';
                    break;
                case 'beta':
                    roleBadge = '<span class="badge badge-outline badge_role badge_beta badge-sm">Beta</span>';
                    break;
                default:
                    roleBadge = '<span class="badge badge-outline badge_role badge-ghost badge-sm">N/A</span>';
            }

            // Badge statut
            let statusBadge = '';
            const statusLabel = user.status || 'N/A';
            switch (user.status) {
                case 'pending':
                    statusBadge = `<span class="badge_s_pending">${statusLabel}</span>`;
                    break;
                case 'active':
                    statusBadge = `<span class="badge_s_active">${statusLabel}</span>`;
                    break;
                case 'inactive':
                    statusBadge = `<span class="badge_s_inactive">${statusLabel}</span>`;
                    break;
                case 'suspended':
                    statusBadge = `<span class="badge_s_suspended">${statusLabel}</span>`;
                    break;
                case 'banned':
                    statusBadge = `<span class="badge_s_banned">${statusLabel}</span>`;
                    break;
                case 'deleted':
                    statusBadge = `<span class="badge_s_deleted">${statusLabel}</span>`;
                    break;
                default:
                    statusBadge = `<span class="badge_s_inactive">${statusLabel}</span>`;
            }

            // Classes conditionnelles pour "Créé par" et "Dernière connexion"
            const createdByClass = user.created_by === 'N/A' ? 'text-sm text-neutral-content' : 'text-sm';
            const lastConnectionClass = user.last_connection === 'N/A' ? 'text-sm text-neutral-content' : 'text-sm';

            tr.innerHTML = `
                <td>${user.login}</td>
                <td class="text-left">${statusBadge}</td>
                <td class="font-medium">${user.email}</td>
                <td class="${lastConnectionClass}">${user.last_connection}</td>
                <td>${roleBadge}</td>
                <td class="${createdByClass}">${user.created_by}</td>
                <td class="text-sm">${user.createdAt}</td>
                <td class="text-right">
                    <div class="flex justify-end items-center gap-2 w-full">
                        <button onclick="window.location.href='/admin/users/${user.id}/view'" class="btn btn-sm btn-outline w-[38.25px] h-[32px] pt-[2px]">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button onclick="window.location.href='/admin/users/${user.id}/edit'" class="btn btn-sm btn-outline btn-accent w-[38.25px] h-[32px] pt-[2px]">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button onclick="openDeleteUserModal('${user.id}', '${user.login}')" class="btn btn-sm btn-error btn-outline w-[38.25px] h-[32px] pt-[2px]">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            fragment.appendChild(tr);
        });

        elements.tableBody.appendChild(fragment);
    }

    function updatePagination() {
        const currentPage = Math.floor(state.offset / state.limit) + 1;
        const totalPages = Math.ceil(state.total / state.limit);

        // Update compteur
        const _start = state.total === 0 ? 0 : state.offset + 1;
        const end = Math.min(state.offset + state.limit, state.total);
        elements.countLabel.textContent = `${end} sur ${state.total}`;

        // Update boutons
        elements.currentBtn.textContent = currentPage;
        elements.prevBtn.disabled = currentPage <= 1;
        elements.nextBtn.disabled = currentPage >= totalPages;

        // Style boutons désactivés
        elements.prevBtn.classList.toggle('btn-disabled', currentPage <= 1);
        elements.nextBtn.classList.toggle('btn-disabled', currentPage >= totalPages);
    }

    function handleLimitChange(e) {
        state.limit = parseInt(e.target.value);
        state.offset = 0; // Retour première page
        loadUsers();
    }

    function handlePageChange(direction) {
        const newOffset = state.offset + direction * state.limit;
        if (newOffset >= 0 && newOffset < state.total) {
            state.offset = newOffset;
            loadUsers();
        }
    }

    function handleSearchFieldChange(e) {
        state.searchField = e.target.value;
        if (state.search) {
            // Si on a déjà une recherche, on recharge
            state.offset = 0;
            loadUsers();
        }
    }

    function handleExport() {
        const params = new URLSearchParams({
            search: state.search,
        });
        window.location.href = `/admin/users/export-excel?${params}`;
    }

    function handleExportCSV() {
        const params = new URLSearchParams({
            search: state.search,
        });
        window.location.href = `/admin/users/export-csv?${params}`;
    }
});
