document.addEventListener('DOMContentLoaded', () => {
    const chartEl = document.getElementById('statTopSite_chart');
    const legendEl = document.getElementById('statTopSite_legend');
    let chart = null;

    if (!chartEl) {
        return;
    }

    async function fetchData() {
        try {
            // Controller is fixed to 90 days
            const resp = await fetch(`/stats/top-site-forms`, { credentials: 'same-origin' });
            if (!resp.ok) {
                throw new Error('Network error');
            }
            return await resp.json();
        } catch (err) {
            console.error(err);
            return { site: null, labels: [], series: [] };
        }
    }

    function render(site, labels, series) {
        if (!site) {
            chartEl.innerHTML = '<div class="text-center text-sm text-muted">Aucun site actif sur la période</div>';
            if (legendEl) {
                legendEl.textContent = '';
            }
            return;
        }

        const total = series.reduce((a, b) => a + b, 0);
        const seriesUp = series.map((v) => (v / total) * 100);

        const options = {
            chart: {
                height: 'auto',
                width: 300,
                type: 'radialBar',
                toolbar: { show: false },
            },
            plotOptions: {
                radialBar: {
                    offsetY: 0,
                    startAngle: 0,
                    endAngle: 270,
                    hollow: {
                        margin: 5,
                        size: '30%',
                        background: 'transparent',
                        image: undefined,
                    },
                    dataLabels: {
                        name: {
                            show: false,
                        },
                        value: {
                            show: false,
                        },
                    },
                    barLabels: {
                        enabled: true,
                        useSeriesColors: true,
                        offsetX: -8,
                        fontSize: '14px',
                        formatter: function (seriesName, opts) {
                            const index = opts.seriesIndex;
                            return seriesName + ': ' + series[index];
                        },
                    },
                },
            },
            colors: ['#0075C3'],
            fill: {
                type: 'solid',
                colors: undefined,
            },
            theme: {
                monochrome: {
                    enabled: true,
                    color: '#0075C3',
                    shadeTo: 'dark',
                    shadeIntensity: 0.6,
                },
            },
            series: seriesUp,
            labels: labels,
            legend: { show: false },
            tooltip: { enabled: false },
            responsive: [
                {
                    breakpoint: 200,
                    options: {
                        chart: { width: 200 },
                    },
                },
            ],
        };

        if (chart) {
            chart.updateOptions({ labels, series });
            chart.updateSeries(series);
        } else {
            chart = new ApexCharts(chartEl, options);
            chart.render();
        }

        // site.total
        if (legendEl) {
            legendEl.textContent = `${site.domain}`;
        }
    }

    async function load() {
        const data = await fetchData();
        render(data.site, data.labels || [], data.series || []);
    }

    setTimeout(load, 80);
});
