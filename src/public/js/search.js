document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search');
    if (!input) return;

    // Collect all site cards and remember original order
    const allSites = Array.from(document.querySelectorAll('.dash-site'));
    allSites.forEach((el, idx) => { el.dataset.originalIndex = idx; });

    // Group sites by parent container so reordering stays local
    const groups = new Map();
    allSites.forEach(el => {
        const parent = el.parentElement;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(el);
    });

    // Debounce timer
    let timer = null;
    input.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
        applyFilter(input.value.trim());
        }, 500);
    });

    // Filtering and ordering logic
    function applyFilter(rawTerm) {
        const term = rawTerm.toLowerCase();

        groups.forEach((els, parent) => {
        // partition
        const matches = [];
        const nonMatches = [];

        els.forEach(el => {
            const domain = (el.getAttribute('domain') || el.dataset.domain || '') + '';
            const lc = domain.toLowerCase();
            if (term && lc.includes(term)) matches.push(el);
            else nonMatches.push(el);
        });

        // visual update: set opacity 50% on non-matches when searching
        els.forEach(el => {
            const domain = (el.getAttribute('domain') || el.dataset.domain || '') + '';
            const lc = domain.toLowerCase();
            if (!term) {
            el.style.opacity = '';
            } else {
            if (lc.includes(term)) el.style.opacity = '';
            else el.style.opacity = '0.5';
            }
        });

        // Ordering: when a search term exists, place matches before non-matches preserving DOM order within each group
        if (term) {
            // append matches first, then nonMatches
            matches.forEach(el => parent.appendChild(el));
            nonMatches.forEach(el => parent.appendChild(el));
        } else {
            // restore original ordering
            const ordered = els.slice().sort((a, b) => {
            return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
            });
            ordered.forEach(el => parent.appendChild(el));
        }
        });
    }
});
