document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn_copy_token');
    if (!btn) {
        return;
    }
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const siteId = btn.dataset.siteId;
        if (!siteId) {
            return;
        }
        const old = btn.innerHTML;
        try {
            const resp = await fetch(`/site/${siteId}/token`, { method: 'GET', credentials: 'same-origin' });
            if (!resp.ok) {
                throw new Error('Network response not ok');
            }
            const json = await resp.json();
            if (json.token) {
                await navigator.clipboard.writeText(json.token);
                // show temporary success state
                btn.innerHTML = `<i class="fas fa-check"></i> ${window.__i18n?.token_copied_short || 'Token copié'}`;
                Toast({ text: window.__i18n?.token_copied || 'Token copié dans le presse-papier.', type: 'success' });
                setTimeout(() => {
                    btn.innerHTML = old;
                }, 1200);
            }
        } catch (_err) {
            btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${window.__i18n?.error || 'Erreur'}`;
            Toast({ text: window.__i18n?.token_fetch_error || 'Erreur lors de la récupération du token.', type: 'error' });
            setTimeout(() => {
                btn.innerHTML = old;
            }, 1600);
        }
    });
});
