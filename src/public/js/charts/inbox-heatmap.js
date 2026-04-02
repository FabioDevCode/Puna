document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('statH_range');
    const chartEl = document.getElementById('statH_chart');
    let chart = null;

    async function fetchData(days) {
        try {
            const resp = await fetch(`/stats/inbox-heatmap?days=${days}`, { credentials: 'same-origin' });
            if (!resp.ok) {
                throw new Error('Network error');
            }
            return await resp.json();
        } catch (err) {
            console.error(err);
            return { hours: [], series: [] };
        }
    }

    function renderChart(hours, series) {
        const options = {
            chart: {
                type: 'heatmap',
                height: 280,
                toolbar: {
                    show: false,
                },
            },
            colors: ['#0075C3'],
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.5,
                    radius: 5,
                    useFillColorAsStroke: false,
                    colorScale: {
                        inverse: false,
                        min: 0,
                        max: undefined,
                        colorStops: [
                            {
                                offset: 0,
                                color: '#ecececff',
                            },
                            {
                                offset: 100,
                                color: '#0075C3',
                            },
                        ],
                    },
                },
            },
            grid: {
                row: {
                    colors: ['#0175C3'], // ← fond de la zone du heatmap
                    opacity: 1,
                },
            },
            states: {
                hover: {
                    filter: {
                        type: 'darken',
                        value: 0.2,
                    },
                },
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: hours,
            },
            // Provide the series up-front so the chart has it when rendering.
            series: series,
            tooltip: {
                y: { formatter: (val) => String(val) },
            },
        };

        // Apex expects series as [{ name, data: [{ x, y }, ...] }, ...]
        if (chart) {
            chart.updateOptions({ xaxis: { categories: hours }, series: series });
        } else {
            chart = new ApexCharts(chartEl, options);
            chart.render();
        }
    }

    async function load(days) {
        const resp = await fetchData(days);
        renderChart(resp.hours || [], resp.series || []);
    }

    // Load default: 7 derniers jours
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
