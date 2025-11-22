document.addEventListener('DOMContentLoaded', () => {
    // Collect all site cards and remember original order
    const allSites = Array.from(document.querySelectorAll('.dash-site'));
    allSites.forEach((el, idx) => { el.dataset.originalIndex = idx; });

    // Group sites by parent container so reordering stays local
    const groups = new Map();
    allSites.forEach(el => {
        const parent = el.parentElement;
        if (!groups.has(parent)) {groups.set(parent, []);}
        groups.get(parent).push(el);
    });

    // Debounce timer shared for inputs
    let timer = null;

    // core filtering function (same behaviour as before)
    function applyFilter(rawTerm) {
        const term = (rawTerm || '').toLowerCase();

        groups.forEach((els, parent) => {
            const matches = [];
            const nonMatches = [];

            els.forEach(el => {
                const domain = (el.getAttribute('domain') || el.dataset.domain || '') + '';
                const lc = domain.toLowerCase();
                if (term && lc.includes(term)) {matches.push(el);} else {nonMatches.push(el);}
            });

            // visual update: set opacity 50% on non-matches when searching
            els.forEach(el => {
                const domain = (el.getAttribute('domain') || el.dataset.domain || '') + '';
                const lc = domain.toLowerCase();
                if (!term) {
                    el.style.opacity = '';
                } else {
                    if (lc.includes(term)) {el.style.opacity = '';} else {el.style.opacity = '0.5';}
                }
            });

            // Ordering: when a search term exists, place matches before non-matches preserving DOM order within each group
            if (term) {
                matches.forEach(el => parent.appendChild(el));
                nonMatches.forEach(el => parent.appendChild(el));
            } else {
                const ordered = els.slice().sort((a, b) => {
                    return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
                });
                ordered.forEach(el => parent.appendChild(el));
            }
        });
    }

    // Helper to attach debounce input handler
    function attachInputHandler(inputEl) {
        if (!inputEl) {return;}
        inputEl.addEventListener('input', () => {
            if (timer) {clearTimeout(timer);}
            timer = setTimeout(() => {
                applyFilter(inputEl.value.trim());
            }, 500);
        });
    }

    // Setup original inline search if still present
    const inlineInput = document.getElementById('search');
    if (inlineInput) {attachInputHandler(inlineInput);}

    // Modal elements
    const modalToggle = document.getElementById('search-modal-toggle');
    const modalInput = document.getElementById('modal-search-input');
    const modalBtn = document.getElementById('modal-search-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const badgesContainer = document.getElementById('search-badges');

    if (modalInput) {
        // Do NOT attach input handler to modal input - only search on Enter or button click

        // Enter key in modal input triggers search and closes modal
        modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = modalInput.value.trim();
                applyFilter(term);
                if (modalToggle) {modalToggle.checked = false;}
                if (term) {addSearchBadge(term);}
            }
        });
    }

    if (modalBtn) {
        modalBtn.addEventListener('click', () => {
            const term = modalInput ? modalInput.value.trim() : '';
            if (modalInput) {applyFilter(term);}
            if (modalToggle) {modalToggle.checked = false;}
            if (term) {addSearchBadge(term);}
        });
    }

    // Helper: escape simple html to prevent injection in badges
    function escapeHtml(str) {
        return String(str).replace(/[&<>"'`]/g, (s) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '`':'&#x60;' })[s]);
    }

    function removeBadges() {
        if (!badgesContainer) {return;}
        badgesContainer.innerHTML = '';
    }

    // add a single badge with text and a small cross
    function addSearchBadge(text) {
        if (!badgesContainer) {return;}
        removeBadges();
        const badge = document.createElement('div');
        // Use plain Tailwind/Daisy classes: transparent bg, 1px neutral border, neutral text
        badge.className = 'inline-flex items-center gap-1 cursor-pointer px-2 py-1/2 rounded-full border border-neutral text-neutral bg-transparent text-sm';
        badge.innerHTML = `${escapeHtml(text)} <span class="text-sm text-neutral">×</span>`;
        badge.title = 'Cliquer pour réinitialiser la recherche';
        badge.addEventListener('click', () => {
            // reset inputs
            if (modalInput) {modalInput.value = '';}
            if (inlineInput) {inlineInput.value = '';}
            // restore default alphabetical ordering and visuals
            restoreDefaultOrdering();
            removeBadges();
            // ensure modal closed
            if (modalToggle) {modalToggle.checked = false;}
        });
        badgesContainer.appendChild(badge);
    }

    // restore default ordering: alphabetical by domain and reset opacity
    function restoreDefaultOrdering() {
        groups.forEach((els, parent) => {
            // sort by domain text
            const sorted = els.slice().sort((a, b) => {
                const da = ((a.getAttribute('domain') || a.dataset.domain || '') + '').toLowerCase();
                const db = ((b.getAttribute('domain') || b.dataset.domain || '') + '').toLowerCase();
                return da.localeCompare(db, undefined, { sensitivity: 'base' });
            });
            sorted.forEach(el => {
                el.style.opacity = '';
                parent.appendChild(el);
            });
        });
    }

    // If user clicks 'Annuler' while modal has text, reset filter
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', (e) => {
            // Prevent the label default toggling so we can control the checkbox state reliably
            e.preventDefault();
            const term = modalInput ? modalInput.value.trim() : '';
            if (term) {
                // clear inputs and reset
                if (modalInput) {modalInput.value = '';}
                if (inlineInput) {inlineInput.value = '';}
                restoreDefaultOrdering();
                removeBadges();
            }
            // explicitly close the modal
            if (modalToggle) {modalToggle.checked = false;}
        });
    }

    // Expose function to open modal (used by hint button)
    window.openSearchModal = function () {
        if (modalToggle) {
            modalToggle.checked = true;
            // focus the input shortly after the modal becomes visible
            setTimeout(() => { if (modalInput) {modalInput.focus();} }, 80);
        }
    };

    // Global shortcut: Ctrl/Cmd + K opens the modal
    document.addEventListener('keydown', (e) => {
        const key = e.key && e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'k') {
            e.preventDefault();
            window.openSearchModal();
        }
    });
});
