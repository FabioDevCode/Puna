(function () {
    const elDate = document.getElementById('statC-date');
    const elHour = document.getElementById('statC-hour');
    if (!elDate || !elHour) {
        return;
    }

    [elDate, elHour].forEach((el) => {
        el.style.transition = 'opacity 360ms cubic-bezier(.2,.9,.2,1), transform 360ms cubic-bezier(.2,.9,.2,1)';
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
        el.style.willChange = 'opacity, transform';
        el.setAttribute('aria-hidden', 'true');
    });

    async function loadLast() {
        try {
            const resp = await fetch('/stats/last-inbox', { credentials: 'same-origin' });
            if (!resp.ok) {
                return;
            }
            const json = await resp.json();
            const date = json.date || '—';
            const time = json.time || '';

            // set content then animate in
            elDate.textContent = date;
            elHour.textContent = time;

            // force reflow then show
            void elDate.offsetWidth;
            [elDate, elHour].forEach((el) => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
                el.removeAttribute('aria-hidden');
            });
        } catch (e) {
            console.warn('Could not load statB data', e);
        }
    }

    setTimeout(loadLast, 80);
})();
