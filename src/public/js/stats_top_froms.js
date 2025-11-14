(function(){
    const select = document.getElementById('statTop_range');
    const tbody = document.getElementById('statTop_body');
    if (!select || !tbody) return;

    function render(items) {
        tbody.innerHTML = '';
        if (!items || !items.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-sm text-muted">Aucune donnée</td></tr>';
            return;
        }
        items.forEach((it) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="align-top">${it.rank}</td>
                <td class="align-top">${it.form_name || '—'}</td>
                <td class="align-top">${it.site_domain || '—'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function load() {
        const days = select.value || '7';
        try {
            const resp = await fetch(`/stats/top-froms?days=${encodeURIComponent(days)}`, { credentials: 'same-origin' });
            if (!resp.ok) {
                render([]);
                return;
            }
            const json = await resp.json();
            const items = json.items || [];
            render(items);
        } catch (e) {
            console.warn('Could not load top-froms', e);
            render([]);
        }
    }

    select.addEventListener('change', load);
    setTimeout(load, 80);
})();
