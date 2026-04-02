(function () {
    const tablist = document.getElementById('statTop_range');
    const tbody = document.getElementById('statTop_body');
    if (!tablist || !tbody) {
        return;
    }

    function render(items) {
        tbody.innerHTML = '';

        const maxCount = items && items.length ? Math.max(...items.map((it) => it.count || 0), 1) : 1;

        // Always render 5 rows (top 5). If not enough items, fill with '-'
        for (let i = 0; i < 5; i++) {
            const it = items && items[i] ? items[i] : null;
            const rank = i + 1;
            const formName = it && it.form_name ? it.form_name : '-';
            const siteDomain = it && it.site_domain ? it.site_domain : '-';
            const count = it ? it.count || 0 : 0;
            const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

            const tr = document.createElement('tr');
            if (it && it.form_id) {
                tr.classList.add('cursor-pointer', 'hover');
                tr.addEventListener('click', () => {
                    window.location.href = `/form/${it.form_id}/inbox`;
                });
            }
            tr.innerHTML = `
                <td class="align-top">${rank}</td>
                <td class="align-top">${formName}</td>
                <td class="align-top">${siteDomain}</td>
                <td class="align-top text-right">
                    <div class="flex items-center justify-end gap-2">
                        <div class="w-16 bg-base-200 rounded-full h-2 overflow-hidden">
                            <div class="bg-secondary h-2 rounded-full" style="width: ${pct}%"></div>
                        </div>
                        <span class="text-xs font-medium min-w-[2ch] text-right">${count}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    }

    async function load() {
        const activeTab = tablist.querySelector('.tab-active');
        const days = activeTab ? activeTab.dataset.value : '7';
        try {
            const resp = await fetch(`/stats/top-froms?days=${encodeURIComponent(days)}`, {
                credentials: 'same-origin',
            });
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

    tablist.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            tablist.querySelector('.tab-active')?.classList.remove('tab-active');
            tab.classList.add('tab-active');
            load();
        });
    });
    setTimeout(load, 80);
})();
