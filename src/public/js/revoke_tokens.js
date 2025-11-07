document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn_revoke_tokens');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const siteId = btn.dataset.siteId;
        if (!siteId) return;
        const old = btn.innerHTML;
        try {
            const resp = await fetch(`/site/${siteId}/revoke-tokens`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok || !json.success) throw new Error(json.error || 'Network response not ok');

            btn.innerHTML = '<i class="fas fa-check"></i> Révocation effectuée';
            setTimeout(() => { btn.innerHTML = old; btn.disabled = false; }, 1400);
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erreur';
            setTimeout(() => { btn.innerHTML = old; btn.disabled = false; }, 1600);
        }
    });
});
