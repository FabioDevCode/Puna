document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('statA_range');
    const chartEl = document.getElementById('statA_chart');
    const totalEl = document.getElementById('statA_total');
    let chart = null;

    async function fetchData(days) {
        try {
            const resp = await fetch(`/stats/inbox-counts?days=${days}`, { credentials: 'same-origin' });
            if (!resp.ok) {
                throw new Error('Network error');
            }
            return await resp.json();
        } catch (err) {
            console.error(err);
            return { labels: [], data: [] };
        }
    }

    function renderChart(labels, series) {
        const options = {
            chart: {
                type: 'line',
                height: 344,
                toolbar: {
                    show: false,
                },
                zoom: {
                    enabled: false,
                },
            },
            colors: ['#0075C3'],
            series: [
                {
                    name: '',
                    data: series,
                },
            ],
            xaxis: {
                categories: labels,
                axisBorder: {
                    show: false,
                },
            },
            stroke: { curve: 'smooth' },
            markers: { size: 5 },
            grid: {
                show: true,
                borderColor: '#6C7B89',
                strokeDashArray: 4,
            },
            tooltip: {
                x: {
                    format: 'yyyy-MM-dd',
                },
            },
        };

        if (chart) {
            chart.updateOptions({ xaxis: { categories: labels } });
            chart.updateSeries([{ name: '', data: series }]);
        } else {
            chart = new ApexCharts(chartEl, options);
            chart.render();
        }
    }

    async function load(days) {
        const resp = await fetchData(days);
        const data = resp.data || [];
        const total = data.reduce((sum, v) => sum + v, 0);
        if (totalEl) {
            const fmt = (window.__i18n && window.__i18n.inbox_count_summary) || '{{total}} sur {{days}}j';
            totalEl.textContent = fmt.replace('{{total}}', total).replace('{{days}}', days);
        }
        renderChart(resp.labels || [], data);
    }

    load(7);

    range.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            range.querySelector('.tab-active')?.classList.remove('tab-active');
            tab.classList.add('tab-active');
            const val = parseInt(tab.dataset.value, 10) || 7;
            load(val);
        });
    });
});
