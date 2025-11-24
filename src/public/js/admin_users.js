document.addEventListener('DOMContentLoaded', () => {
    // État de la page
    const state = {
        limit: 10,
        offset: 0,
        total: 0,
        search: '',
        isLoading: false
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
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearch')
    };

    // Initialisation
    init();

    function init() {
        // Event listeners
        elements.limitSelect.addEventListener('change', handleLimitChange);
        elements.prevBtn.addEventListener('click', () => handlePageChange(-1));
        elements.nextBtn.addEventListener('click', () => handlePageChange(1));
        elements.exportBtn.addEventListener('click', handleExport);

        // Setup recherche
        setupSearch();

        // Chargement initial
        loadUsers();
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
        if (state.isLoading) return;
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
                search: state.search
            });

            const response = await fetch(`/admin/users/list?${params}`);
            if (!response.ok) throw new Error('Erreur réseau');

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

        users.forEach(user => {
            const tr = document.createElement('tr');
            // tr.className = 'hover';

            // Badge rôle
            let roleBadge = '';
            switch (user.role) {
                case 'super_admin':
                    roleBadge = '<span class="badge badge-outline badge_super_admin badge-sm">Super Admin</span>';
                    break;
                case 'owner':
                    roleBadge = '<span class="badge badge-outline badge_owner badge-sm">Owner</span>';
                    break;
                case 'editor':
                    roleBadge = '<span class="badge badge-outline badge_editor badge-sm">Editor</span>';
                    break;
                case 'viewer':
                    roleBadge = '<span class="badge badge-outline badge_viewer badge-sm">Viewer</span>';
                    break;
                case 'beta':
                    roleBadge = '<span class="badge badge-outline badge_beta badge-sm">Beta</span>';
                    break;
                default:
                    roleBadge = '<span class="badge badge-outline badge-ghost badge-sm">N/A</span>';
            }

            // Statut activé
            const statusIcon = user.enabled
                ? '<span class="badge badge-success w-[20px] mt-2 badge-md" title="Activé"></span>'
                : '<span class="badge badge-error w-[20px] mt-2 badge-md" title="Désactivé"></span>';

            tr.innerHTML = `
                <td class="font-medium">${user.email}</td>
                <td>${user.login}</td>
                <td>${roleBadge}</td>
                <td class="text-sm text-neutral-content">${user.created_by}</td>
                <td class="text-left">${statusIcon}</td>
                <td class="text-sm">${user.last_connection}</td>
                <td class="text-sm">${user.createdAt}</td>
                <td class="text-right">
                    <div class="flex justify-end items-center gap-2 w-full">
                        <button class="btn btn-sm btn-outline w-[38.25px] h-[32px] pt-[2px]">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-accent w-[38.25px] h-[32px] pt-[2px]">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-sm btn-error btn-outline w-[38.25px] h-[32px] pt-[2px]">
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
        const start = state.total === 0 ? 0 : state.offset + 1;
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
        const newOffset = state.offset + (direction * state.limit);
        if (newOffset >= 0 && newOffset < state.total) {
            state.offset = newOffset;
            loadUsers();
        }
    }

    function handleExport() {
        const params = new URLSearchParams({
            search: state.search
        });
        window.location.href = `/admin/users/export-excel?${params}`;
    }
});
