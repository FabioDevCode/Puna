(function () {
    const el = document.getElementById('statC_chart');
    if (!el) {
        return;
    }

    async function loadData() {
        try {
            const resp = await fetch('/stats/inbox-by-site', { credentials: 'same-origin' });
            if (!resp.ok) {
                return;
            }
            const json = await resp.json();
            const labels = json.labels || [];
            const data = json.data || [];
            const ids = json.ids || [];
            const total = data.reduce((s, v) => s + v, 0);

            el.innerHTML = '';

            if (labels.length === 0) {
                el.innerHTML = '<p class="text-sm text-muted text-center">Aucune donnée</p>';
                return;
            }

            if (total === 0) {
                el.innerHTML = '<p class="text-sm text-muted text-center">Aucune soumission pour le moment</p>';
                return;
            }

            // Filter: only sites with at least 1 inbox, max 12
            const items = labels
                .map((label, i) => ({ label, count: data[i] || 0, siteId: ids[i] }))
                .filter((it) => it.count > 0)
                .slice(0, 12);

            if (items.length === 0) {
                el.innerHTML = '<p class="text-sm text-muted text-center">Aucune soumission pour le moment</p>';
                return;
            }

            // 2 columns if more than 7 items, else 1 column
            const cols = items.length > 7 ? 2 : 1;
            el.classList.remove('flex', 'flex-col', 'justify-center');
            el.style.display = 'grid';
            el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            el.style.alignContent = 'start';

            items.forEach(({ label, count, siteId }) => {
                const pct = Math.round((count / total) * 100);

                const row = document.createElement('a');
                row.href = siteId ? `/site/${siteId}/view` : '#';
                row.className = 'flex flex-col gap-1 px-1 py-1 rounded hover:bg-base-200 transition-colors cursor-pointer no-underline';

                row.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-sm truncate">${label}</span>
                        <span class="text-xs text-muted">${count} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-base-200 rounded-full h-2 overflow-hidden">
                        <div class="bg-secondary h-2 rounded-full transition-all" style="width: ${pct}%"></div>
                    </div>
                `;

                el.appendChild(row);
            });
        } catch (e) {
            console.warn('Could not load statC data', e);
        }
    }

    loadData();
})();
