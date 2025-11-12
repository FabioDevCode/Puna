document.addEventListener('DOMContentLoaded', () => {
    const range = document.getElementById('statH_range');
    const chartEl = document.getElementById('statH_chart');
    let chart = null;

    async function fetchData(days) {
        try {
            const resp = await fetch(`/stats/inbox-heatmap?days=${days}`, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('Network error');
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
                height: 360,
                toolbar: { show: false }
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
                                color: '#F3F8FC'
                            },
                            {
                                offset: 100,
                                color: '#0075C3'
                            }
                        ]
                    }
                }
            },
            states: {
                hover: {
                    filter: {
                        type: 'darken',
                        value: 0.2,
                    }
                }
            },
            dataLabels: { enabled: false },
            xaxis: { categories: hours },
            tooltip: {
                y: { formatter: (val) => String(val) }
            }
        };

        // Apex expects series as [{ name, data: [{ x, y }, ...] }, ...]
        if (chart) {
            chart.updateOptions({ xaxis: { categories: hours } });
            chart.updateSeries(series);
        } else {
            chart = new ApexCharts(chartEl, options);
            chart.render();
            chart.updateSeries(series);
        }
    }

    async function load(days) {
        const resp = await fetchData(days);
        renderChart(resp.hours || [], resp.series || []);
    }

    load(30);

    range.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 30;
        load(val);
    });
});
