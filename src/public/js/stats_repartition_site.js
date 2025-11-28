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

            const options = {
                chart: {
                    type: 'donut',
                },
                labels: labels,
                series: data,
                legend: {
                    position: 'bottom',
                },
                stroke: {
                    show: true,
                    width: 2,
                    colors: '#CFE4F5',
                },
                theme: {
                    monochrome: {
                        enabled: true,
                        color: '#0075C3',
                        shadeTo: 'light',
                        shadeIntensity: 0.5,
                    },
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '56%',
                        },
                    },
                },
                tooltip: {
                    y: {
                        formatter: function (val) {
                            return val;
                        },
                    },
                },
                responsive: [
                    {
                        breakpoint: 640,
                        options: {
                            chart: {
                                width: 300,
                            },
                            legend: {
                                position: 'bottom',
                            },
                        },
                    },
                ],
            };

            if (window.statCChart) {
                window.statCChart.updateOptions({ labels: labels, series: data });
            } else {
                window.statCChart = new ApexCharts(el, options);
                window.statCChart.render();
            }
        } catch (e) {
            console.warn('Could not load statC data', e);
        }
    }

    loadData();
})();
