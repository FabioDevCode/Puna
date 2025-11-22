(function (){
    const select = document.getElementById('statTop_range');
    const tbody = document.getElementById('statTop_body');
    if (!select || !tbody) {return;}

    function render(items) {
        tbody.innerHTML = '';

        // Always render 5 rows (top 5). If not enough items, fill with '-'
        for (let i = 0; i < 5; i++) {
            const it = (items && items[i]) ? items[i] : null;
            const rank = i + 1;
            const formName = it && it.form_name ? it.form_name : '-';
            const siteDomain = it && it.site_domain ? it.site_domain : '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="align-top">${rank}</td>
                <td class="align-top">${formName}</td>
                <td class="align-top">${siteDomain}</td>
            `;
            tbody.appendChild(tr);
        }
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
