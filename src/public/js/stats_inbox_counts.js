document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('statA_range');
    const chartEl = document.getElementById('statA_chart');
    let chart = null;

    async function fetchData(days) {
        try {
            const resp = await fetch(`/stats/inbox-counts?days=${days}`, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('Network error');
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
                    show: false
                },
                zoom: {
                    enabled: false
                }
            },
            colors: ['#0075C3'],
            series: [
                {
                    name: "",
                    data: series
                }
            ],
            xaxis: {
                categories: labels,
                axisBorder: {
                    show: false,
                }
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
                    format: 'yyyy-MM-dd'
                }
            }
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
        renderChart(resp.labels || [], resp.data || []);
    }

    load(7);

    range.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 7;
        load(val);
    });
});