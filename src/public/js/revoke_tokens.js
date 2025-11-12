document.addEventListener('DOMContentLoaded', () => {
    // Bind all confirm buttons inside revoke modal(s). The opener is a label that opens the modal;
    // the actual network request is performed when the user clicks the confirm button.
    document.querySelectorAll('.btn-confirm-revoke').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const siteId = btn.dataset.siteId;
            if (!siteId) return;

            // Disable while in progress (no extra animation/change on main opener button)
            btn.disabled = true;
            try {
                const resp = await fetch(`/site/${siteId}/revoke-tokens`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' }
                });
                const json = await resp.json().catch(() => ({}));
                if (!resp.ok || !json.success) throw new Error(json.error || 'Network response not ok');

                // Close modal by unchecking the linked checkbox
                const modalCheckbox = document.getElementById(`revoke_tokens_modal_${siteId}`);
                if (modalCheckbox) modalCheckbox.checked = false;

                // Optionally show a lightweight feedback on the opener (no animation): briefly replace text
                const opener = document.getElementById(`btn_revoke_tokens_opener_${siteId}`);
                if (opener) {
                    const old = opener.innerHTML;
                    opener.innerHTML = '<i class="fas fa-check"></i> Révoqué';
                    setTimeout(() => { opener.innerHTML = old; }, 1400);
                }
            } catch (err) {
                // Minimal error feedback
                alert('Erreur lors de la révocation des tokens.');
            } finally {
                btn.disabled = false;
            }
        });
    });
});
