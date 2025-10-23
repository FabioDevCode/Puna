document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn_copy_token');
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const siteId = btn.dataset.siteId;
        if (!siteId) return;

        btn.classList.add('loading');

        try {
            const resp = await fetch(`/site/${siteId}/token`, { method: 'GET', credentials: 'same-origin' });
            if (!resp.ok) throw new Error('Network response not ok');
            const json = await resp.json();
            if (json.token) {
                await navigator.clipboard.writeText(json.token);
                // show temporary success state
                btn.classList.remove('loading');
                const old = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copié';
                setTimeout(() => { btn.innerHTML = old; }, 1200);
            }
        } catch (err) {
            btn.classList.remove('loading');
            const old = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erreur';
            setTimeout(() => { btn.innerHTML = old; }, 1600);
        }
    });
});
