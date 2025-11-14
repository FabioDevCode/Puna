(function(){
    const ids = [
        { key: 'today', label: "Aujourd'hui" },
        { key: '7', label: '7 jours' },
        { key: '30', label: '30 jours' }
    ];

    const els = {};
    ids.forEach(i => {
        els[i.key] = {
            value: document.getElementById(`percent-${i.key}`),
            icon: document.getElementById(`icon-${i.key}`),
        };
        if (els[i.key].value) {
            els[i.key].value.style.transition = 'opacity 360ms cubic-bezier(.2,.9,.2,1), transform 360ms cubic-bezier(.2,.9,.2,1)';
            els[i.key].value.style.opacity = '0';
            els[i.key].value.style.transform = 'translateY(6px)';
            els[i.key].value.setAttribute('aria-hidden','true');
        }
    });

    function applyTrend(elSet, data) {
        if (!elSet || !elSet.value) return;
        const trend = data.trend || 'neutral';
        const sign = trend === 'up' ? '+' : (trend === 'down' ? '-' : '');
        elSet.value.textContent = `${sign}${data.percent}%`;

        // icon
        if (trend === 'up') {
            elSet.icon.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
            elSet.value.classList.remove('text-down');
            elSet.value.classList.add('text-secondary');
        } else if (trend === 'down') {
            elSet.icon.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>';
            elSet.value.classList.remove('text-secondary');
            elSet.value.classList.add('text-down');
        } else {
            elSet.icon.innerHTML = '';
            elSet.value.classList.remove('text-secondary','text-down');
        }

        // animate in
        void elSet.value.offsetWidth;
        elSet.value.style.opacity = '1';
        elSet.value.style.transform = 'translateY(0)';
        elSet.value.removeAttribute('aria-hidden');
    }

    async function load() {
        try {
            const resp = await fetch('/stats/inbox-percentages', { credentials: 'same-origin' });
            if (!resp.ok) return;
            const json = await resp.json();
            if (!json) return;

            applyTrend(els['today'], json.today || { percent:0, trend:'neutral', current:0, previous:0 });
            applyTrend(els['7'], json.last7 || { percent:0, trend:'neutral', current:0, previous:0 });
            applyTrend(els['30'], json.last30 || { percent:0, trend:'neutral', current:0, previous:0 });
        } catch (e) {
            console.warn('Could not load inbox percentages', e);
        }
    }

    setTimeout(load, 80);
})();
