(function () {
    if (window.__mcpKeysInit) return;
    window.__mcpKeysInit = true;

    const tbody = document.getElementById('mcp-keys-body');
    const emptyRow = document.getElementById('mcp-keys-empty');
    const modalCreate = document.getElementById('modal_new_mcp_key');
    const modalToken = document.getElementById('modal_show_mcp_token');

    if (!tbody || !modalCreate || !modalToken) return;

    function csrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    function formatDate(value) {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function scopeBadge(scope) {
        const map = {
            read: 'badge-info',
            read_write: 'badge-warning',
            read_write_access: 'badge-error',
        };
        return `<span class="badge badge-sm badge-outline ${map[scope] || ''}">${scope}</span>`;
    }

    function buildRow(key) {
        const tr = document.createElement('tr');
        tr.dataset.id = key.id;
        tr.innerHTML = `
            <td class="font-medium">${escapeHtml(key.name)}</td>
            <td>${scopeBadge(key.scope)}</td>
            <td class="text-sm">${formatDate(key.expires_at)}</td>
            <td class="text-sm">${formatDate(key.last_used_at)}</td>
            <td class="text-right">
                <button class="btn btn-sm btn-error btn-outline w-[38px] h-[32px] pt-[2px] btn-delete-mcp-key" data-id="${key.id}" title="Supprimer">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>`;
        return tr;
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function syncEmptyState() {
        const hasRows = tbody.querySelectorAll('tr[data-id]').length > 0;
        if (emptyRow) emptyRow.style.display = hasRows ? 'none' : '';
    }

    // ── Chargement initial des clés ──────────────────────────────
    async function loadKeys() {
        try {
            const res = await fetch('/mcp_keys', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const { keys } = await res.json();
            keys.forEach((key) => {
                tbody.appendChild(buildRow(key));
            });
            syncEmptyState();
        } catch (_e) {
            // silencieux : le tableau reste vide
        }
    }

    loadKeys();

    // ── Ouverture modal création ─────────────────────────────────
    document.getElementById('btn-new-mcp-key')?.addEventListener('click', () => {
        document.getElementById('mcp-key-name').value = '';
        document.getElementById('mcp-key-scope').value = 'read';
        document.getElementById('mcp-key-expires').value = '';
        document.getElementById('mcp-key-name-error').classList.add('hidden');
        modalCreate.showModal();
    });

    // ── Soumission création ──────────────────────────────────────
    document.getElementById('btn-submit-mcp-key')?.addEventListener('click', async () => {
        const name = document.getElementById('mcp-key-name').value.trim();
        const scope = document.getElementById('mcp-key-scope').value;
        const expires_at = document.getElementById('mcp-key-expires').value || null;
        const nameError = document.getElementById('mcp-key-name-error');

        if (!name) {
            nameError.textContent = 'Le nom est requis.';
            nameError.classList.remove('hidden');
            return;
        }
        nameError.classList.add('hidden');

        const btn = document.getElementById('btn-submit-mcp-key');
        btn.disabled = true;
        btn.textContent = 'Création…';

        try {
            const res = await fetch('/mcp_keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({ name, scope, expires_at }),
            });

            const data = await res.json();

            if (!res.ok) {
                nameError.textContent = data.error || 'Une erreur est survenue.';
                nameError.classList.remove('hidden');
                return;
            }

            // Fermer modal création
            modalCreate.close();

            // Ajouter la ligne dans le tableau
            tbody.appendChild(buildRow(data.key));
            syncEmptyState();

            // Afficher le token en clair dans la modal one-shot
            document.getElementById('mcp-token-display').value = data.token;
            document.getElementById('mcp-token-copied').classList.add('hidden');
            modalToken.showModal();
        } catch (_e) {
            nameError.textContent = 'Erreur réseau. Veuillez réessayer.';
            nameError.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Créer la clé';
        }
    });

    // ── Copier le token ──────────────────────────────────────────
    document.getElementById('btn-copy-mcp-token')?.addEventListener('click', () => {
        const val = document.getElementById('mcp-token-display').value;
        if (!val) return;
        navigator.clipboard.writeText(val).then(() => {
            const msg = document.getElementById('mcp-token-copied');
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 3000);
        });
    });

    // ── Suppression d'une clé : ouverture modal confirmation ────
    const modalDelete = document.getElementById('modal_delete_mcp_key');
    const deleteKeyName = document.getElementById('mcp-delete-key-name');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-mcp-key');
    let pendingDeleteId = null;

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-mcp-key');
        if (!btn) return;

        pendingDeleteId = btn.dataset.id;
        const row = tbody.querySelector(`tr[data-id="${pendingDeleteId}"]`);
        const name = row?.querySelector('td')?.textContent?.trim() || '';
        if (deleteKeyName) deleteKeyName.textContent = name;
        modalDelete?.showModal();
    });

    btnConfirmDelete?.addEventListener('click', async () => {
        if (!pendingDeleteId) return;

        btnConfirmDelete.disabled = true;

        try {
            const res = await fetch(`/mcp_keys/${pendingDeleteId}`, {
                method: 'DELETE',
                headers: {
                    'x-csrf-token': csrfToken(),
                    Accept: 'application/json',
                },
            });

            if (res.ok) {
                const row = tbody.querySelector(`tr[data-id="${pendingDeleteId}"]`);
                if (row) row.remove();
                syncEmptyState();
                modalDelete?.close();
            }
        } catch (_e) {
            // silencieux
        } finally {
            btnConfirmDelete.disabled = false;
            pendingDeleteId = null;
        }
    });
})();
