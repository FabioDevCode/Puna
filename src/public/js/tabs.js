    /**
     * Réinitialise les filtres et l'état visuel du bouton Filtre
     */
    function resetFiltersUI() {
        tabState.filters = {};
        const btnFilter = document.getElementById('filtreTableBtn');
        if (btnFilter && btnFilter.classList) {
            btnFilter.classList.remove('btn-success');
        }
    }
/**
 * TooltipManager - Manages a single tooltip element for displaying truncated text
 */
class TooltipManager {
    constructor() {
        this.tooltipElement = null;
    }

    /**
     * Ensures tooltip element exists and returns it
     * @returns {HTMLElement} The tooltip element
     */
    ensureElement() {
        if (this.tooltipElement) {
            return this.tooltipElement;
        }
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'inbox-tooltip';
        this.tooltipElement.className = 'inbox-tooltip none';
        document.body.appendChild(this.tooltipElement);
        return this.tooltipElement;
    }

    /**
     * Shows tooltip at specified coordinates
     * @param {string} text - Text to display
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    show(text, x, y) {
        const el = this.ensureElement();
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.classList.remove('none');
    }

    /**
     * Moves tooltip to new coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    move(x, y) {
        const el = this.ensureElement();
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    /**
     * Hides the tooltip
     */
    hide() {
        if (!this.tooltipElement) {
            return;
        }
        this.tooltipElement.classList.add('none');
    }
}

/**
 * DateFormatter - Utility class for date formatting
 */
class DateFormatter {
    /**
     * Pads number with leading zero if needed
     * @param {number} n - Number to pad
     * @returns {string} Padded string
     */
    static pad2(n) {
        return String(n).padStart(2, '0');
    }

    /**
     * Formats a date/time value as YYYY-MM-DD HH:MM:SS
     * @param {Date|string|number} value - Value to format
     * @returns {string} Formatted date string or fallback
     */
    static formatDateTime(value) {
        if (!value && value !== 0) {
            return ' - ';
        }
        try {
            const d = (value instanceof Date) ? value : new Date(value);
            if (Number.isNaN(d.getTime())) {
                return String(value);
            }
            const year = d.getFullYear();
            const month = this.pad2(d.getMonth() + 1);
            const day = this.pad2(d.getDate());
            const hours = this.pad2(d.getHours());
            const minutes = this.pad2(d.getMinutes());
            const seconds = this.pad2(d.getSeconds());
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (e) {
            return String(value);
        }
    }

    /**
     * Formats a date value as YYYY-MM-DD for date inputs
     * @param {Date|string|number} value - Value to format
     * @returns {string} Formatted date string or empty string
     */
    static formatDateYYYYMMDD(value) {
        if (!value && value !== 0) {
            return '';
        }
        try {
            const d = (value instanceof Date) ? value : new Date(value);
            if (Number.isNaN(d.getTime())) {
                return String(value);
            }
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return String(value);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tooltipManager = new TooltipManager();

    // State management for active tab data
    const tabState = {
        template: {},
        keys: [],
        columns: null,
        formId: null,
        visibleKeys: [],
        filters: {}
    };

    /**
     * Réinitialise les filtres et l'état visuel du bouton Filtre
     */
    function resetFiltersUI() {
        tabState.filters = {};
        const btnFilter = document.getElementById('filtreTableBtn');
        if (btnFilter && btnFilter.classList) {
            btnFilter.classList.remove('btn-success');
        }
    }

    const tabLists = document.querySelectorAll('.tabs');
    const tableActions = document.getElementById('tableActions');

    /**
     * ColumnsModal - Manages column visibility modal
     */
    class ColumnsModal {
        constructor() {
            this.btnColumns = document.getElementById('btn_columns');
            this.modal = document.getElementById('modal_columns');
            this.columnsList = document.getElementById('modal_columns_list');
            this.form = document.getElementById('modal_columns_form');
            this.cancelBtn = document.getElementById('modal_columns_cancel');
            this.btnFilter = document.getElementById('filtreTableBtn');

            this.initializeEventListeners();
        }

        /**
         * Sets up event listeners for modal interactions
         */
        initializeEventListeners() {
            if (this.btnColumns) {
                this.btnColumns.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.open();
                });
            }

            if (this.cancelBtn) {
                this.cancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.close();
                });
            }

            if (this.form) {
                this.form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.save();
                });
            }
        }

        /**
         * Opens the columns modal and populates it with available columns
         */
        open() {
            if (!this.modal || !this.columnsList) {
                return;
            }

            this.columnsList.innerHTML = '';

            if (!tabState.keys.length) {
                this.columnsList.innerHTML = '<p class="text-sm text-muted">Aucune colonne disponible pour ce formulaire.</p>';
            } else {
                tabState.keys.forEach((key) => {
                    const label = this.createColumnCheckbox(key);
                    this.columnsList.appendChild(label);
                });
            }

            try {
                this.modal.showModal();
            } catch (e) {
                console.error(e);
            }
        }

        /**
         * Creates a checkbox element for a column
         * @param {string} key - Column key
         * @returns {HTMLElement} Label element containing checkbox
         */
        createColumnCheckbox(key) {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 p-2 rounded bg-base-100';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = `col_${key}`;
            checkbox.dataset.key = key;
            checkbox.checked = tabState.columns ? !!tabState.columns[key] : true;
            checkbox.className = 'checkbox checkbox-secondary';

            const span = document.createElement('span');
            span.textContent = tabState.template[key] || key;

            label.appendChild(checkbox);
            label.appendChild(span);

            return label;
        }

        /**
         * Saves column visibility preferences
         */
        async save() {
            if (!tabState.formId) {
                return;
            }

            const inputs = this.columnsList ? Array.from(this.columnsList.querySelectorAll('input[type="checkbox"][data-key]')) : [];
            const payload = {};

            inputs.forEach((input) => {
                const key = input.dataset.key;
                payload[key] = !!input.checked;
            });

            try {
                const response = await fetch(`/form/${tabState.formId}/columns`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ columns: payload })
                });

                const json = await response.json().catch(() => ({}));

                if (!response.ok || !json.success) {
                    throw new Error(json.error || 'Network error');
                }

                tabState.columns = payload;

                const activeTab = document.querySelector('.tab.tab-active[data-id]');
                if (activeTab) {
                    activeTab.dataset.columns = JSON.stringify(payload);
                }

                this.close();

                if (activeTab) {
                    activeTab.click();
                }
            } catch (err) {
                alert('Erreur lors de l\'enregistrement des colonnes.');
            }
        }

        /**
         * Closes the columns modal
         */
        close() {
            if (!this.modal) {
                return;
            }
            try {
                this.modal.close();
            } catch (e) {
                console.error(e);
            }
        }
    }

    const columnsModal = new ColumnsModal();

    tabLists.forEach((tabList) => {
        tabList.addEventListener('click', (e) => {
            const target = e.target.closest('[role="tab"], .tab');
            if (!target || !tabList.contains(target)) {return;}
            e.preventDefault();
            resetFiltersUI();

            const tabs = Array.from(tabList.querySelectorAll('[role="tab"], .tab'));
            tabs.forEach((t) => {
                t.classList.remove('tab-active');
                t.setAttribute('aria-selected', 'false');
            });

            target.classList.add('tab-active');
            target.setAttribute('aria-selected', 'true');

            const hasId = !!(target.dataset && target.dataset.id);

            const infoPanel = document.getElementById('info_form_panel');
            if (infoPanel) {
                const name = target.dataset.name || 'Formulaire';
                const code = target.dataset.code || '';

                const h4 = document.getElementById('info_form_name');
                if (h4) {
                    h4.textContent = name;
                    if (hasId) {h4.classList.remove('opacity-25');} else {h4.classList.add('opacity-25');}
                }

                const deleteInput = document.getElementById('form_delete_id');
                const deleteBtn = document.getElementById('btn_delete_form');
                if (deleteInput) {deleteInput.value = target.dataset.id || '';}
                if (deleteBtn) {
                    if (hasId) {deleteBtn.classList.remove('none');} else {deleteBtn.classList.add('none');}
                }

                const codeEl = document.getElementById('info_form_code');
                const codeWrap = document.getElementById('info_form_code_wrap');
                const copyBtn = document.getElementById('btn_copy_code');
                if (codeEl) {codeEl.textContent = code;}
                if (codeWrap) {
                    if (hasId) {codeWrap.classList.remove('opacity-25');} else {codeWrap.classList.add('opacity-25');}
                }
                if (copyBtn) {
                    if (hasId) {copyBtn.classList.remove('none');} else {copyBtn.classList.add('none');}
                }
            }

            const btnOpenTemplate = document.getElementById('btn_open_template');
            const modalForm = document.getElementById('modal_template_form');
            const keysContainer = document.getElementById('modal_template_keys');
            const valuesContainer = document.getElementById('modal_template_values');

            function clearModalContainers() {
                if (keysContainer) {keysContainer.innerHTML = '';}
                if (valuesContainer) {valuesContainer.innerHTML = '';}
            }

            if (hasId) {
                if (btnOpenTemplate) {btnOpenTemplate.classList.remove('none');}

                if (modalForm) {modalForm.action = `/form/${target.dataset.id}/template`;}

                let tpl = {};
                try {
                    const raw = target.dataset.template || '';
                    if (raw) {tpl = JSON.parse(raw);}
                } catch (e) {
                    tpl = {};
                }

                clearModalContainers();
                const keys = Object.keys(tpl || {});

                // Update global tab state
                tabState.template = tpl || {};
                tabState.keys = keys;
                tabState.formId = target.dataset.id || null;

                let colsObj = {};
                try {
                    const rawc = target.dataset.columns || '';
                    if (rawc) {
                        colsObj = JSON.parse(rawc);
                    }
                } catch (e) {
                    colsObj = {};
                }
                tabState.columns = colsObj;

                const visibleKeys = keys.filter((k) => (colsObj && typeof colsObj[k] !== 'undefined') ? !!colsObj[k] : true);
                if (!keys.length) {
                    if (keysContainer) {keysContainer.innerHTML = '<p class="text-sm text-muted">Aucune clé définie pour ce formulaire.</p>';}
                    if (valuesContainer) {valuesContainer.innerHTML = '';}
                } else {
                    keys.forEach((k) => {
                        const d = document.createElement('div');
                        d.className = 'px-2 py-1 rounded h-[32px] bg-neutral-content/50 text-sm bg-base-100';
                        d.textContent = k;
                        keysContainer.appendChild(d);

                        const wrap = document.createElement('div');
                        wrap.className = 'flex items-center gap-2';
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.name = `template[${k}]`;
                        input.value = tpl[k] || '';
                        input.className = 'input input-bordered w-full input-sm';
                        wrap.appendChild(input);
                        valuesContainer.appendChild(wrap);
                    });
                }

                /**
                 * InboxTable - Manages inbox table rendering and pagination
                 */
                class InboxTable {
                    constructor(formId, visibleKeys) {
                        this.formId = formId;
                        this.visibleKeys = visibleKeys;
                        this.currentPage = 1;
                        this.MAX_CELL_LENGTH = 100;

                        // DOM elements
                        this.headElement = document.getElementById('inbox_table_head');
                        this.bodyElement = document.getElementById('inbox_table_body');
                        this.tableElement = document.getElementById('tableInbox');
                        this.selectLimit = document.getElementById('numLignTable');
                        this.paginationElement = document.getElementById('paginationTable');
                    }

                    /**
                     * Clears the inbox table and hides it
                     */
                    clear() {
                        if (this.headElement) {
                            this.headElement.innerHTML = '';
                        }
                        if (this.bodyElement) {
                            this.bodyElement.innerHTML = '';
                        }

                        const countEl = document.getElementById('count_inbox');
                        if (countEl) {
                            countEl.textContent = '';
                        }

                        if (tableActions) {
                            tableActions.classList.add('none');
                        }
                        if (this.tableElement) {
                            this.tableElement.classList.add('none');
                        }
                    }

                    /**
                     * Builds table header with column names
                     * @param {string[]} keysArr - Array of column keys
                     */
                    buildHead(keysArr) {
                        if (!this.headElement) {
                            return;
                        }

                        const tr = document.createElement('tr');

                        // Date column
                        const thDate = document.createElement('th');
                        thDate.textContent = 'Date';
                        tr.appendChild(thDate);

                        // Data columns
                        if (!keysArr.length) {
                            const th = document.createElement('th');
                            th.textContent = 'Données';
                            tr.appendChild(th);
                        } else {
                            keysArr.forEach((key) => {
                                const th = document.createElement('th');
                                th.textContent = tabState.template[key] || key;
                                tr.appendChild(th);
                            });
                        }

                        // Action column
                        const thAction = document.createElement('th');
                        tr.appendChild(thAction);

                        this.headElement.appendChild(tr);
                    }

                    /**
                     * Renders a table cell with truncation support
                     * @param {*} value - Cell value
                     * @returns {HTMLElement} Table cell element
                     */
                    renderCell(value) {
                        const td = document.createElement('td');
                        const str = value !== undefined && value !== null ? String(value) : '';

                        if (str.length > this.MAX_CELL_LENGTH) {
                            td.textContent = str.substring(0, this.MAX_CELL_LENGTH) + '...';
                            td.classList.add('inbox-cell-truncated');

                            td.addEventListener('mouseenter', (ev) => {
                                tooltipManager.show(str, ev.pageX + 12, ev.pageY + 12);
                            });
                            td.addEventListener('mousemove', (ev) => {
                                tooltipManager.move(ev.pageX + 12, ev.pageY + 12);
                            });
                            td.addEventListener('mouseleave', () => {
                                tooltipManager.hide();
                            });
                        } else {
                            td.textContent = str;
                        }

                        return td;
                    }

                    /**
                     * Builds table rows from items
                     * @param {Array} items - Array of inbox items
                     * @param {string[]} keysArr - Array of column keys
                     */
                    buildRows(items, keysArr) {
                        if (!this.bodyElement) {
                            return;
                        }

                        items.forEach((item) => {
                            const tr = document.createElement('tr');
                            tr.dataset.id = item.id;

                            // Date column
                            const tdDate = document.createElement('td');
                            tdDate.textContent = item.createdAt ? DateFormatter.formatDateTime(item.createdAt) : ' - ';
                            tr.appendChild(tdDate);

                            const content = item.content || {};

                            // Data columns
                            if (!keysArr.length) {
                                const td = this.renderCell(JSON.stringify(content));
                                tr.appendChild(td);
                            } else {
                                keysArr.forEach((key) => {
                                    const td = this.renderCell(content[key]);
                                    tr.appendChild(td);
                                });
                            }

                            // Action column
                            const tdAction = document.createElement('td');
                            tdAction.innerHTML = `
                            <button class="btn btn-sm btn-neutral btn-outline btn-circle noo pt-[2px]">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>`;
                            tr.appendChild(tdAction);

                            this.bodyElement.appendChild(tr);
                        });
                    }

                    /**
                     * Renders the complete table with pagination
                     * @param {Array} pageItems - Items to display on current page
                     * @param {string[]} keysArr - Array of column keys
                     * @param {number} total - Total number of items
                     */
                    render(pageItems, keysArr, total) {
                        const limit = this.selectLimit ? parseInt(this.selectLimit.value, 10) || 10 : 10;
                        const maxPage = Math.max(1, Math.ceil((total || 0) / limit));

                        if (this.currentPage > maxPage) {
                            this.currentPage = maxPage;
                        }

                        // Clear and rebuild table
                        if (this.headElement) {
                            this.headElement.innerHTML = '';
                        }
                        if (this.bodyElement) {
                            this.bodyElement.innerHTML = '';
                        }

                        this.buildHead(keysArr);
                        this.buildRows(pageItems || [], keysArr);

                        // Update table visibility
                        if (total && total > 0) {
                            if (tableActions) {
                                tableActions.classList.remove('none');
                            }
                            if (this.tableElement) {
                                this.tableElement.classList.remove('none');
                            }
                        } else {
                            if (tableActions) {
                                tableActions.classList.add('none');
                            }
                            if (this.tableElement) {
                                this.tableElement.classList.add('none');
                            }
                        }

                        // Update count display
                        const countEl = document.getElementById('count_inbox');
                        const shown = Array.isArray(pageItems) ? pageItems.length : 0;
                        if (countEl) {
                            countEl.textContent = (shown > 0 || (total && total > 0)) ? `${shown} sur ${total}` : '';
                        }

                        // Update pagination controls
                        if (this.paginationElement) {
                            const buttons = Array.from(this.paginationElement.querySelectorAll('button'));
                            if (buttons[1]) {
                                buttons[1].textContent = `${this.currentPage}`;
                            }
                            if (buttons[0]) {
                                buttons[0].disabled = this.currentPage <= 1;
                            }
                            if (buttons[2]) {
                                buttons[2].disabled = this.currentPage >= maxPage;
                            }
                        }
                    }
                    /**
                     * Fetches and displays a specific page of inbox data
                     * @param {number} page - Page number to fetch
                     */
                    fetchPage(page) {
                        const limit = this.selectLimit ? parseInt(this.selectLimit.value, 10) || 10 : 10;
                        const pageNumber = page && page > 0 ? page : 1;
                        const offset = (pageNumber - 1) * limit;

                        // Build URL with filters
                        let url = `/form/${this.formId}/inbox?limit=${limit}&offset=${offset}`;

                        try {
                            if (tabState.filters && Object.keys(tabState.filters).length) {
                                url += `&filters=${encodeURIComponent(JSON.stringify(tabState.filters))}`;
                            }
                        } catch (e) {
                            // Ignore JSON errors
                        }

                        // Add cache-busting parameter
                        url += `&_=${Date.now()}`;

                        try {
                            if (console && typeof console.debug === 'function') {
                                console.debug('Fetching inbox', url, tabState.filters);
                            }
                        } catch (e) {
                            // Ignore console errors
                        }

                        fetch(url, { credentials: 'same-origin' })
                            .then((response) => response.json())
                            .then((data) => {
                                const items = data.items || [];
                                const total = parseInt(data.total, 10) || 0;
                                this.currentPage = pageNumber;

                                this.setupEventListeners(limit, total);
                                this.render(items, this.visibleKeys, total);
                            })
                            .catch(() => {
                                this.clear();
                            });
                    }

                    /**
                     * Sets up pagination and limit change event listeners
                     * @param {number} limit - Current page size limit
                     * @param {number} total - Total number of items
                     */
                    setupEventListeners(limit, total) {
                        // Limit select change listener - only set once
                        if (this.selectLimit && !this.selectLimit.dataset.listenerAttached) {
                            this.selectLimit.addEventListener('change', () => {
                                this.fetchPage(1);
                            });
                            this.selectLimit.dataset.listenerAttached = 'true';
                        }

                        // Pagination button listeners - re-create handlers each time
                        if (this.paginationElement) {
                            const buttons = Array.from(this.paginationElement.querySelectorAll('button'));
                            const [prevBtn, pageBtn, nextBtn] = buttons;

                            if (prevBtn) {
                                // Remove old listener if exists and add new one
                                const newPrevBtn = prevBtn.cloneNode(true);
                                prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
                                newPrevBtn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    if (this.currentPage > 1) {
                                        this.fetchPage(this.currentPage - 1);
                                    }
                                });
                            }

                            if (nextBtn) {
                                // Remove old listener if exists and add new one
                                const newNextBtn = nextBtn.cloneNode(true);
                                nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
                                newNextBtn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    const maxPage = Math.max(1, Math.ceil(total / limit));
                                    if (this.currentPage < maxPage) {
                                        this.fetchPage(this.currentPage + 1);
                                    }
                                });
                            }

                            if (pageBtn) {
                                pageBtn.textContent = String(this.currentPage);
                            }
                        }
                    }
                }

                // Initialize and load inbox table
                const inboxTable = new InboxTable(target.dataset.id, visibleKeys);
                inboxTable.clear();
                inboxTable.fetchPage(1);

                /**
                 * FilterModal - Manages filter modal and filtering logic
                 */
                class FilterModal {
                    constructor(btnFilter, visibleKeys, inboxTable) {
                        this.btnFilter = btnFilter;
                        this.visibleKeys = visibleKeys;
                        this.inboxTable = inboxTable;

                        this.modal = document.getElementById('modal_filter');
                        this.form = document.getElementById('modal_filter_form');
                        this.keysContainer = document.getElementById('modal_filter_keys');
                        this.valuesContainer = document.getElementById('modal_filter_values');
                        this.cancelBtn = document.getElementById('modal_filter_cancel');
                        this.clearBtn = document.getElementById('modal_filter_clear');

                        this.initializeEventListeners();
                    }

                    /**
                     * Sets up event listeners for filter modal
                     */
                    initializeEventListeners() {
                        if (this.btnFilter && !this.btnFilter.dataset.listenerAttached) {
                            this.btnFilter.addEventListener('click', (ev) => {
                                ev.preventDefault();
                                this.open();
                            });
                            this.btnFilter.dataset.listenerAttached = 'true';
                        }

                        if (this.cancelBtn && !this.cancelBtn.dataset.listenerAttached) {
                            this.cancelBtn.addEventListener('click', (ev) => {
                                ev.preventDefault();
                                this.cancelAndReset();
                            });
                            this.cancelBtn.dataset.listenerAttached = 'true';
                        }

                        if (this.clearBtn && !this.clearBtn.dataset.listenerAttached) {
                            this.clearBtn.addEventListener('click', (ev) => {
                                ev.preventDefault();
                                this.clearInputs();
                            });
                            this.clearBtn.dataset.listenerAttached = 'true';
                        }

                        if (this.form && !this.form.dataset.listenerAttached) {
                            this.form.addEventListener('submit', (ev) => {
                                ev.preventDefault();
                                this.apply();
                            });
                            this.form.dataset.listenerAttached = 'true';
                        }
                    }

                    /**
                     * Opens the filter modal and populates filter fields
                     */
                    open() {
                        if (this.keysContainer) {
                            this.keysContainer.innerHTML = '';
                        }
                        if (this.valuesContainer) {
                            this.valuesContainer.innerHTML = '';
                        }

                        // Store snapshot of visible keys for use in filter creation
                        // This ensures we filter on the currently visible columns
                        tabState.visibleKeys = (this.visibleKeys || []).slice();

                        if (!tabState.visibleKeys || !tabState.visibleKeys.length) {
                            if (this.keysContainer) {
                                this.keysContainer.innerHTML = '<p class="text-sm text-muted">Aucune colonne disponible pour filtrer.</p>';
                            }
                        } else {
                            this.createDateFilter();
                            this.createColumnFilters();
                            this.setupScrollSync();
                        }

                        try {
                            this.modal.showModal();
                        } catch (e) {
                            try {
                                this.modal.classList.remove('none');
                            } catch (err) {
                                // Ignore errors
                            }
                        }
                    }

                    /**
                     * Creates date filter input fields
                     */
                    createDateFilter() {
                        if (this.keysContainer) {
                            const leftDateWrap = document.createElement('div');
                            leftDateWrap.className = '';
                            const leftDateInput = document.createElement('input');
                            leftDateInput.type = 'text';
                            leftDateInput.disabled = true;
                            leftDateInput.value = 'Date';
                            leftDateInput.className = 'input input-bordered w-full input-sm bg-base-100';
                            leftDateWrap.appendChild(leftDateInput);
                            this.keysContainer.appendChild(leftDateWrap);
                        }

                        if (this.valuesContainer) {
                            const rightDateWrap = document.createElement('div');
                            rightDateWrap.className = '';
                            const dateInput = document.createElement('input');
                            dateInput.type = 'text';
                            dateInput.placeholder = 'YYYY-MM-DD';
                            dateInput.pattern = '^\\d{4}-\\d{2}-\\d{2}$';
                            dateInput.title = 'Format attendu : YYYY-MM-DD';
                            dateInput.id = 'modal_filter_date';
                            dateInput.dataset.key = 'createdAt';
                            dateInput.name = 'filter[createdAt]';
                            dateInput.className = 'input input-bordered w-full input-sm';
                            if (tabState.filters && tabState.filters.createdAt) {
                                dateInput.value = DateFormatter.formatDateYYYYMMDD(tabState.filters.createdAt);
                            }
                            rightDateWrap.appendChild(dateInput);
                            this.valuesContainer.appendChild(rightDateWrap);
                        }
                    }

                    /**
                     * Creates filter inputs for each visible column
                     */
                    createColumnFilters() {
                        tabState.visibleKeys.forEach((key) => {
                            if (this.keysContainer) {
                                const leftWrap = document.createElement('div');
                                leftWrap.className = '';
                                const leftInput = document.createElement('input');
                                leftInput.type = 'text';
                                leftInput.disabled = true;
                                leftInput.className = 'input input-bordered w-full input-sm bg-base-100';
                                leftInput.value = tabState.template[key] || key;
                                leftWrap.appendChild(leftInput);
                                this.keysContainer.appendChild(leftWrap);
                            }

                            if (this.valuesContainer) {
                                const rightWrap = document.createElement('div');
                                rightWrap.className = '';
                                const input = document.createElement('input');
                                input.type = 'text';
                                input.dataset.key = key;
                                input.name = `filter[${key}]`;
                                input.className = 'input input-bordered w-full input-sm';
                                if (tabState.filters && typeof tabState.filters[key] !== 'undefined') {
                                    input.value = tabState.filters[key];
                                }
                                rightWrap.appendChild(input);
                                this.valuesContainer.appendChild(rightWrap);
                            }
                        });
                    }

                    /**
                     * Synchronizes scroll between keys and values columns
                     */
                    setupScrollSync() {
                        try {
                            this.keysContainer.style.overflow = 'auto';
                            this.keysContainer.style.maxHeight = '320px';
                            this.valuesContainer.style.overflow = 'auto';
                            this.valuesContainer.style.maxHeight = '320px';

                            let syncing = false;

                            this.keysContainer.addEventListener('scroll', () => {
                                if (syncing) {
                                    return;
                                }
                                syncing = true;
                                this.valuesContainer.scrollTop = this.keysContainer.scrollTop;
                                requestAnimationFrame(() => {
                                    syncing = false;
                                });
                            });

                            this.valuesContainer.addEventListener('scroll', () => {
                                if (syncing) {
                                    return;
                                }
                                syncing = true;
                                this.keysContainer.scrollTop = this.valuesContainer.scrollTop;
                                requestAnimationFrame(() => {
                                    syncing = false;
                                });
                            });
                        } catch (e) {
                            // Ignore scroll sync errors
                        }
                    }

                    /**
                     * Clears all filter inputs
                     */
                    clearInputs() {
                        try {
                            const dateInput = document.getElementById('modal_filter_date');
                            if (dateInput) {
                                dateInput.value = '';
                            }
                        } catch (e) {
                            // Ignore errors
                        }

                        try {
                            const inputs = this.valuesContainer ? Array.from(this.valuesContainer.querySelectorAll('input[data-key]')) : [];
                            inputs.forEach((input) => {
                                input.value = '';
                            });
                        } catch (e) {
                            // Ignore errors
                        }
                    }

                    /**
                     * Cancels filtering, resets filters and reloads data
                     */
                    cancelAndReset() {
                        this.clearInputs();
                        tabState.filters = {};

                        if (this.btnFilter) {
                            this.btnFilter.classList.remove('btn-success');
                            this.btnFilter.classList.remove('btn-warning');
                        }

                        try {
                            this.modal.close();
                        } catch (e) {
                            try {
                                this.modal.classList.add('none');
                            } catch (err) {
                                // Ignore errors
                            }
                        }

                        try {
                            this.inboxTable.fetchPage(1);
                        } catch (e) {
                            // Ignore errors
                        }
                    }

                    /**
                     * Applies filters and reloads data
                     */
                    apply() {
                        const filters = {};

                        try {
                            const dateInput = document.getElementById('modal_filter_date');
                            if (dateInput && dateInput.value) {
                                filters.createdAt = dateInput.value;
                            }
                        } catch (e) {
                            // Ignore errors
                        }

                        try {
                            const inputs = this.valuesContainer ? Array.from(this.valuesContainer.querySelectorAll('input[data-key]')) : [];
                            inputs.forEach((input) => {
                                const key = input.dataset.key;
                                if (!key) {
                                    return;
                                }
                                const value = input.value ? String(input.value).trim() : '';
                                if (value !== '') {
                                    filters[key] = value;
                                }
                            });
                        } catch (e) {
                            // Ignore errors
                        }

                        tabState.filters = filters;

                        try {
                            if (this.btnFilter) {
                                if (tabState.filters && Object.keys(tabState.filters).length) {
                                    this.btnFilter.classList.add('btn-success');
                                    this.btnFilter.classList.remove('btn-warning');
                                } else {
                                    this.btnFilter.classList.remove('btn-success');
                                    this.btnFilter.classList.remove('btn-warning');
                                }
                            }
                        } catch (e) {
                            // Ignore errors
                        }

                        try {
                            this.modal.close();
                        } catch (e) {
                            this.modal.classList.add('none');
                        }

                        this.inboxTable.fetchPage(1);
                    }
                }

                // Initialize filter modal
                const btnFilter = columnsModal.btnFilter;
                const _filterModal = new FilterModal(btnFilter, visibleKeys, inboxTable);

            } else {
                // hide button and clear modal
                if (btnOpenTemplate) {btnOpenTemplate.classList.add('none');}
                if (modalForm) {modalForm.action = '#';}
                clearModalContainers();
                // hide table-level actions and clear inbox table
                if (tableActions) {tableActions.classList.add('none');}
                const inboxHead = document.getElementById('inbox_table_head');
                const inboxBody = document.getElementById('inbox_table_body');
                if (inboxHead) {inboxHead.innerHTML = '';}
                if (inboxBody) {inboxBody.innerHTML = '';}
            }
        });

        // Initialize panel from any active tab on load
        const active = tabList.querySelector('.tab.tab-active[data-id], [role="tab"].tab-active[data-id]');
        if (active) {
            active.click();
        } else {
            // no active form tab selected on load -> ensure panel is in empty state
            const deleteBtn = document.getElementById('btn_delete_form');
            const copyBtn = document.getElementById('btn_copy_code');
            const h4 = document.getElementById('info_form_name');
            const codeWrap = document.getElementById('info_form_code_wrap');
            const codeEl = document.getElementById('info_form_code');
            if (deleteBtn) {deleteBtn.classList.add('none');}
            if (copyBtn) {copyBtn.classList.add('none');}
            if (h4) {h4.classList.add('opacity-25');}
            if (codeWrap) {codeWrap.classList.add('opacity-25');}
            if (codeEl) {codeEl.textContent = '';}
            // hide table actions and clear inbox table when nothing is selected
            if (tableActions) {tableActions.classList.add('none');}
            const inboxHeadInit = document.getElementById('inbox_table_head');
            const inboxBodyInit = document.getElementById('inbox_table_body');
            if (inboxHeadInit) {inboxHeadInit.innerHTML = '';}
            if (inboxBodyInit) {inboxBodyInit.innerHTML = '';}
        }
    });

    // Copy-to-clipboard for info_form_code via button
    const copyBtn = document.getElementById('btn_copy_code');
    if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const codeEl = document.getElementById('info_form_code');
            if (!codeEl) {return;}
            const text = codeEl.textContent.trim();
            if (!text) {return;}

            try {
                await navigator.clipboard.writeText(text);
                // temporary feedback: change button text/icon like token.js but without green color
                const old = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Code copié';
                setTimeout(() => { copyBtn.innerHTML = old; }, 1200);
            } catch (err) {
                console.error(err);
            }
        });
    }
});
