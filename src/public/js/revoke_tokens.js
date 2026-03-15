document.addEventListener('DOMContentLoaded', () => {
    // Bind all confirm buttons inside revoke modal(s). The opener is a label that opens the modal;
    // the actual network request is performed when the user clicks the confirm button.
    document.querySelectorAll('.btn-confirm-revoke').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const siteId = btn.dataset.siteId;
            if (!siteId) {
                return;
            }

            // Disable while in progress (no extra animation/change on main opener button)
            btn.disabled = true;
            try {
                const resp = await fetch(`/site/${siteId}/revoke-tokens`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || '',
                    },
                });
                const json = await resp.json().catch(() => ({}));
                if (!resp.ok || !json.success) {
                    throw new Error(json.error || 'Network response not ok');
                }

                // Close modal by unchecking the linked checkbox
                const modalCheckbox = document.getElementById(`revoke_tokens_modal_${siteId}`);
                if (modalCheckbox) {
                    modalCheckbox.checked = false;
                }

                // Optionally show a lightweight feedback on the opener (no animation): briefly replace text
                const opener = document.getElementById(`btn_revoke_tokens_opener_${siteId}`);
                if (opener) {
                    const old = opener.innerHTML;
                    opener.innerHTML = '<i class="fas fa-check"></i> Révoqué';
                    setTimeout(() => {
                        opener.innerHTML = old;
                    }, 1400);
                }
                Toast({ text: 'Tokens révoqués avec succès.', type: 'success' });
            } catch (_err) {
                // Minimal error feedback
                Toast({ text: 'Erreur lors de la révocation des tokens.', type: 'error' });
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Accessibility: manage aria-hidden and focus when the modal checkbox opens/closes
    document.querySelectorAll('input[id^="revoke_tokens_modal_"]').forEach((chk) => {
        // initialize aria-hidden state
        const modal = chk.nextElementSibling;
        if (modal) {
            modal.setAttribute('aria-hidden', chk.checked ? 'false' : 'true');
        }

        chk.addEventListener('change', () => {
            const m = chk.nextElementSibling;
            if (!m) {
                return;
            }
            if (chk.checked) {
                m.setAttribute('aria-hidden', 'false');
                // focus the confirm button for keyboard users
                const confirm = m.querySelector('.btn-confirm-revoke');
                if (confirm && typeof confirm.focus === 'function') {
                    // small timeout to allow rendering
                    setTimeout(() => confirm.focus(), 10);
                }
            } else {
                m.setAttribute('aria-hidden', 'true');
            }
        });
    });
});
