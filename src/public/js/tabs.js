document.addEventListener('DOMContentLoaded', () => {
    let _inboxTooltipEl = null;

    function ensureInboxTooltip() {
        if (_inboxTooltipEl) { return _inboxTooltipEl; }
        _inboxTooltipEl = document.createElement('div');
        _inboxTooltipEl.id = 'inbox-tooltip';
        _inboxTooltipEl.className = 'inbox-tooltip none';
        document.body.appendChild(_inboxTooltipEl);
        return _inboxTooltipEl;
    }

    function showInboxTooltip(text, x, y) {
        const el = ensureInboxTooltip();
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.classList.remove('none');
    }

    function moveInboxTooltip(x, y) {
        const el = ensureInboxTooltip();
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    function hideInboxTooltip() {
        if (!_inboxTooltipEl) { return; }
        _inboxTooltipEl.classList.add('none');
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function formatDateTime(value) {
        if (!value && value !== 0) { return ' - '; }
        try {
            const d = (value instanceof Date) ? value : new Date(value);
            if (Number.isNaN(d.getTime())) { return String(value); }
            return `
                <div class="flex flex-wrap gap-1">
                    <p class="w-max">${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}&nbsp;</p>
                    <p class="w-max">${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}</p>
                </div>
            `;
        } catch (e) {
            return String(value);
        }
    }

    // Format a date value as YYYY-MM-DD for the date input
    function formatDateYYYYMMDD(value) {
        if (!value && value !== 0) { return ''; }
        try {
            const d = (value instanceof Date) ? value : new Date(value);
            if (Number.isNaN(d.getTime())) { return String(value); }
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch (e) { return String(value); }
    }

    const tabLists = document.querySelectorAll('.tabs');
    const tableActions = document.getElementById('tableActions');

    let activeTpl = {};
    let activeKeys = [];
    let activeColumns = null;
    let activeFormId = null;
    let currentVisibleKeys = [];
    let currentFilters = {};

    const btnColumns = document.getElementById('btn_columns');
    const btnFilter = document.getElementById('filtreTableBtn');
    const modalColumns = document.getElementById('modal_columns');
    const modalColumnsList = document.getElementById('modal_columns_list');
    const modalColumnsForm = document.getElementById('modal_columns_form');
    const modalColumnsCancel = document.getElementById('modal_columns_cancel');

    function resetFilter() {
        currentFilters = {};
        btnFilter.classList.remove('btn-info');
    }

    function openColumnsModal() {
        if (!modalColumns) { return; }

        if (modalColumnsList) {
            modalColumnsList.innerHTML = '';
            if (!activeKeys.length) {
                modalColumnsList.innerHTML = '<p class="text-sm text-muted">Aucune colonne disponible pour ce formulaire.</p>';
            } else {
                activeKeys.forEach((k) => {
                    const label = document.createElement('label');
                    label.className = 'flex items-center gap-2 p-2 rounded bg-base-100';
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.name = `col_${k}`;
                    chk.dataset.key = k;
                    chk.checked = activeColumns ? !!activeColumns[k] : true;
                    chk.className = 'checkbox checkbox-secondary';
                    const span = document.createElement('span');
                    span.textContent = activeTpl[k] || k;
                    label.appendChild(chk);
                    label.appendChild(span);
                    modalColumnsList.appendChild(label);
                });
            }
        }
        try { modalColumns.showModal(); } catch (e) { console.error(e); }
    }

    if (btnColumns) {
        btnColumns.addEventListener('click', (e) => {
            e.preventDefault();

            if (currentFilters && Object.keys(currentFilters).length) {
                currentFilters = {};
                // clear any visual state on filter button
                if (btnFilter && btnFilter.classList) {
                    btnFilter.classList.remove('btn-info');
                }
            }

            // also clear modal inputs if modal exists
            const modalFilterValues = document.getElementById('modal_filter_values');
            if (modalFilterValues) {
                const inputs = Array.from(modalFilterValues.querySelectorAll('input, select, textarea'));
                inputs.forEach((inp) => {
                    if (inp.type === 'checkbox' || inp.type === 'radio') {
                        inp.checked = false;
                    } else {
                        inp.value = '';
                    }
                });
            }

            openColumnsModal();
        });
    }

    if (modalColumnsCancel) {
        modalColumnsCancel.addEventListener('click', (e) => {
            e.preventDefault();
            try { modalColumns.close(); } catch (e) { console.error(e); }
        });
    }

    if (modalColumnsForm) {
        modalColumnsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeFormId) { return; }

            const inputs = modalColumnsList ? Array.from(modalColumnsList.querySelectorAll('input[type="checkbox"][data-key]')) : [];
            const payload = {};
            inputs.forEach((inp) => {
                const k = inp.dataset.key;
                payload[k] = !!inp.checked;
            });

            try {
                const resp = await fetch(`/form/${activeFormId}/columns`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ columns: payload })
                });
                const json = await resp.json().catch(() => ({}));
                if (!resp.ok || !json.success) { throw new Error(json.error || 'Network error'); }

                activeColumns = payload;

                const activeTab = document.querySelector('.tab.tab-active[data-id]');
                if (activeTab) { activeTab.dataset.columns = JSON.stringify(payload); }

                try { modalColumns.close(); } catch (e) { console.error(e); }

                if (activeTab) { activeTab.click(); }
            } catch (err) {
                alert('Erreur lors de l\'enregistrement des colonnes.');
            }
        });
    }

    tabLists.forEach((tabList) => {
        tabList.addEventListener('click', (e) => {
            const target = e.target.closest('[role="tab"], .tab');
            if (!target || !tabList.contains(target)) { return; }
            e.preventDefault();

            resetFilter();

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
                    if (hasId) { h4.classList.remove('opacity-25'); } else { h4.classList.add('opacity-25'); }
                }

                const deleteInput = document.getElementById('form_delete_id');
                const deleteBtn = document.getElementById('btn_delete_form');
                if (deleteInput) { deleteInput.value = target.dataset.id || ''; }
                if (deleteBtn) {
                    if (hasId) { deleteBtn.classList.remove('none'); } else { deleteBtn.classList.add('none'); }
                }

                const codeEl = document.getElementById('info_form_code');
                const codeWrap = document.getElementById('info_form_code_wrap');
                const copyBtn = document.getElementById('btn_copy_code');
                if (codeEl) { codeEl.textContent = code; }
                if (codeWrap) {
                    if (hasId) { codeWrap.classList.remove('opacity-25'); } else { codeWrap.classList.add('opacity-25'); }
                }
                if (copyBtn) {
                    if (hasId) { copyBtn.classList.remove('none'); } else { copyBtn.classList.add('none'); }
                }
            }

            const btnOpenTemplate = document.getElementById('btn_open_template');
            const modalForm = document.getElementById('modal_template_form');
            const keysContainer = document.getElementById('modal_template_keys');
            const valuesContainer = document.getElementById('modal_template_values');

            function clearModalContainers() {
                if (keysContainer) { keysContainer.innerHTML = ''; }
                if (valuesContainer) { valuesContainer.innerHTML = ''; }
            }

            if (hasId) {
                if (btnOpenTemplate) { btnOpenTemplate.classList.remove('none'); }

                if (modalForm) { modalForm.action = `/form/${target.dataset.id}/template`; }

                let tpl = {};
                try {
                    const raw = target.dataset.template || '';
                    if (raw) { tpl = JSON.parse(raw); }
                } catch (e) {
                    tpl = {};
                }

                clearModalContainers();
                const keys = Object.keys(tpl || {});

                activeTpl = tpl || {};
                activeKeys = keys;
                activeFormId = target.dataset.id || null;

                let colsObj = {};
                try {
                    const rawc = target.dataset.columns || '';
                    if (rawc) { colsObj = JSON.parse(rawc); }
                } catch (e) {
                    colsObj = {};
                }
                activeColumns = colsObj;

                const visibleKeys = keys.filter((k) => (colsObj && typeof colsObj[k] !== 'undefined') ? !!colsObj[k] : true);
                if (!keys.length) {
                    if (keysContainer) { keysContainer.innerHTML = '<p class="text-sm text-muted">Aucune clé définie pour ce formulaire.</p>'; }
                    if (valuesContainer) { valuesContainer.innerHTML = ''; }
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

                const inboxHead = document.getElementById('inbox_table_head');
                const inboxBody = document.getElementById('inbox_table_body');
                const tableInboxEl = document.getElementById('tableInbox');

                let currentPage = 1;
                const selectLimit = document.getElementById('numLignTable');
                const paginationEl = document.getElementById('paginationTable');

                function clearInbox() {
                    if (inboxHead) { inboxHead.innerHTML = ''; }
                    if (inboxBody) { inboxBody.innerHTML = ''; }

                    const countEl = document.getElementById('count_inbox');
                    if (countEl) { countEl.textContent = ''; }

                    if (tableActions) { tableActions.classList.add('none'); }
                    if (tableInboxEl) { tableInboxEl.classList.add('none'); }
                }

                function buildHead(keysArr) {
                    if (!inboxHead) { return; }
                    const tr = document.createElement('tr');

                    // const thCheck = document.createElement('th');
                    // thCheck.innerHTML = '<label><input type="checkbox" class="checkbox" /></label>';
                    // tr.appendChild(thCheck);

                    const thDate = document.createElement('th');
                    thDate.textContent = 'Date';
                    tr.appendChild(thDate);

                    if (!keysArr.length) {
                        const th = document.createElement('th');
                        th.textContent = 'Données';
                        tr.appendChild(th);
                    } else {
                        keysArr.forEach((k) => {
                            const th = document.createElement('th');
                            th.textContent = tpl[k] || k;
                            tr.appendChild(th);
                        });
                    }

                    const thAction = document.createElement('th');
                    tr.appendChild(thAction);

                    inboxHead.appendChild(tr);
                }

                function buildRows(items, keysArr) {
                    if (!inboxBody) { return; }
                    items.forEach((it) => {
                        const tr = document.createElement('tr');
                        tr.dataset.id = it.id;

                        // const tdCheck = document.createElement('th');
                        // tdCheck.innerHTML = '<label><input type="checkbox" class="checkbox" /></label>';
                        // tr.appendChild(tdCheck);

                        const content = it.content || {};
                        // Date column
                        const tdDate = document.createElement('td');

                        if (it.createdAt) {
                            tdDate.innerHTML = formatDateTime(it.createdAt);
                        } else {
                            tdDate.textContent = ' - ';
                        }

                        tr.appendChild(tdDate);

                        function renderCell(value) {
                            const td = document.createElement('td');
                            const str = value !== undefined && value !== null ? String(value) : '';
                            const MAX = 80;
                            if (str.length > MAX) {
                                td.textContent = str.substring(0, MAX) + '...';
                                td.classList.add('inbox-cell-truncated');

                                td.addEventListener('mouseenter', (ev) => {
                                    showInboxTooltip(str, ev.pageX + 12, ev.pageY + 12);
                                });
                                td.addEventListener('mousemove', (ev) => {
                                    moveInboxTooltip(ev.pageX + 12, ev.pageY + 12);
                                });
                                td.addEventListener('mouseleave', () => {
                                    hideInboxTooltip();
                                });
                            } else {
                                td.textContent = str;
                            }
                            return td;
                        }

                        if (!keysArr.length) {
                            const td = renderCell(JSON.stringify(content));
                            tr.appendChild(td);
                        } else {
                            keysArr.forEach((k) => {
                                const td = renderCell(content[k]);
                                tr.appendChild(td);
                            });
                        }

                        const tdAct = document.createElement('th');
                        tdAct.innerHTML = `
                        <div class="flex gap-2 w-max">
                            <a href="/inbox/${it.id}" class="btn btn-sm btn-outline btn-circle noo pt-[2px]">
                                <i class="fa-regular fa-eye"></i>
                            </a>
                            <button class="btn btn-sm btn-error btn-outline btn-circle noo pt-[2px] btn-delete-inbox" data-inbox-id="${it.id}" data-form-name="${target.dataset.name || ''}">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                        `;
                        tr.appendChild(tdAct);

                        // Add event listener for delete button
                        const deleteBtn = tdAct.querySelector('.btn-delete-inbox');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                const inboxId = deleteBtn.dataset.inboxId;
                                const formName = deleteBtn.dataset.formName;

                                const modal = document.getElementById('modal_delete_inbox');
                                const form = document.getElementById('formDeleteInbox');
                                const input = document.getElementById('inbox_delete_id');

                                if (modal && form && input) {
                                    input.value = inboxId;
                                    form.action = `/inbox/${inboxId}/delete?redirect=site&formName=${encodeURIComponent(formName)}`;
                                    try { modal.showModal(); } catch (err) { console.error(err); }
                                }
                            });
                        }

                        inboxBody.appendChild(tr);
                    });
                }

                // Render a page using items (page slice returned by server) and total count
                function renderTable(pageItems, keysArr, total) {
                    const limit = selectLimit ? parseInt(selectLimit.value, 10) || 10 : 10;
                    const maxPage = Math.max(1, Math.ceil((total || 0) / limit));
                    if (currentPage > maxPage) { currentPage = maxPage; }

                    // clear and build
                    if (inboxHead) { inboxHead.innerHTML = ''; }
                    if (inboxBody) { inboxBody.innerHTML = ''; }

                    buildHead(keysArr);

                    const items = Array.isArray(pageItems) ? pageItems : [];

                    if (items.length > 0) {
                        buildRows(items, keysArr);
                    } else {
                        // no rows: show an empty state row but keep table visible when filters are active
                        const columnsCount = ((keysArr && keysArr.length) ? keysArr.length : 1) + 2; // date + data cols + actions
                        const trEmpty = document.createElement('tr');
                        const tdEmpty = document.createElement('td');
                        tdEmpty.colSpan = columnsCount;
                        tdEmpty.className = 'text-sm text-center text-muted py-4';
                        tdEmpty.textContent = 'Aucun résultat';
                        trEmpty.appendChild(tdEmpty);
                        if (inboxBody) { inboxBody.appendChild(trEmpty); }
                    }

                    // If there's a filter active we must keep the table and actions visible even with zero results
                    const hasFilters = currentFilters && Object.keys(currentFilters).length > 0;
                    if ((total && total > 0) || hasFilters) {
                        if (tableActions) { tableActions.classList.remove('none'); }
                        if (tableInboxEl) { tableInboxEl.classList.remove('none'); }
                    } else {
                        if (tableActions) { tableActions.classList.add('none'); }
                        if (tableInboxEl) { tableInboxEl.classList.add('none'); }
                    }

                    // update count text to 'affichés sur total'
                    const countEl = document.getElementById('count_inbox');
                    const shown = items.length;
                    if (countEl) { countEl.textContent = `${shown} sur ${total || 0}`; }

                    // update pagination UI if present
                    if (paginationEl) {
                        const btns = Array.from(paginationEl.querySelectorAll('button'));
                        // expect: [prev, center, next]
                        if (btns[1]) { btns[1].textContent = `${currentPage}`; }
                        if (btns[0]) { btns[0].disabled = currentPage <= 1; }
                        if (btns[2]) { btns[2].disabled = currentPage >= maxPage; }
                    }
                }

                // Fetch inbox (server-side pagination)
                clearInbox();

                const fetchPage = (page) => {
                    const limit = selectLimit ? parseInt(selectLimit.value, 10) || 10 : 10;
                    const p = page && page > 0 ? page : 1;
                    const offset = (p - 1) * limit;
                    // build url and include filters if any
                    let url = `/form/${target.dataset.id}/inbox?limit=${limit}&offset=${offset}`;
                    try {
                        if (currentFilters && Object.keys(currentFilters).length) {
                            url += `&filters=${encodeURIComponent(JSON.stringify(currentFilters))}`;
                        }
                    } catch (e) { /* ignore */ }

                    // anti-cache
                    url += `&_=${Date.now()}`;

                    fetch(url, { credentials: 'same-origin' })
                        .then((r) => r.json())
                        .then((data) => {
                            const items = data.items || [];
                            const total = parseInt(data.total, 10) || 0;
                            currentPage = p;

                            // attach select change to fetch first page
                            if (selectLimit) {
                                selectLimit.removeEventListener('change', selectLimit._listener || (() => { }));
                                selectLimit._listener = () => {
                                    fetchPage(1);
                                };
                                selectLimit.addEventListener('change', selectLimit._listener);
                            }

                            // attach pagination buttons
                            if (paginationEl) {
                                const btns = Array.from(paginationEl.querySelectorAll('button'));
                                const prev = btns[0];
                                const pageBtn = btns[1];
                                const next = btns[2];

                                if (prev) {
                                    prev.removeEventListener('click', prev._listener || (() => { }));
                                    prev._listener = (e) => {
                                        e.preventDefault();
                                        if (currentPage > 1) { fetchPage(currentPage - 1); }
                                    };
                                    prev.addEventListener('click', prev._listener);
                                }
                                if (next) {
                                    next.removeEventListener('click', next._listener || (() => { }));
                                    next._listener = (e) => {
                                        e.preventDefault();
                                        const maxPage = Math.max(1, Math.ceil(total / limit));
                                        if (currentPage < maxPage) { fetchPage(currentPage + 1); }
                                    };
                                    next.addEventListener('click', next._listener);
                                }
                                // initial page label
                                if (pageBtn) { pageBtn.textContent = String(currentPage); }
                            }

                            // render returned page
                            renderTable(items, visibleKeys, total);
                        })
                        .catch(() => {
                            clearInbox();
                        });
                };

                // initial load
                fetchPage(1);

                // =====================
                // Filter modal logic
                // =====================
                try {
                    const modalFilter = document.getElementById('modal_filter');
                    const modalFilterForm = document.getElementById('modal_filter_form');
                    const modalFilterKeys = document.getElementById('modal_filter_keys');
                    const modalFilterValues = document.getElementById('modal_filter_values');
                    const modalFilterCancel = document.getElementById('modal_filter_cancel');
                    const modalFilterClear = document.getElementById('modal_filter_clear');

                    if (btnFilter) {
                        btnFilter.removeEventListener('click', btnFilter._listener || (() => { }));
                        btnFilter._listener = (ev) => {
                            ev.preventDefault();
                            if (modalFilterKeys) { modalFilterKeys.innerHTML = ''; }
                            if (modalFilterValues) { modalFilterValues.innerHTML = ''; }

                            // prepare visible keys snapshot
                            currentVisibleKeys = (visibleKeys || []).slice();

                            if (!currentVisibleKeys || !currentVisibleKeys.length) {
                                if (modalFilterKeys) { modalFilterKeys.innerHTML = '<p class="text-sm text-muted">Aucune colonne disponible pour filtrer.</p>'; }
                            } else {
                                // Date label left (disabled input) and date input right
                                if (modalFilterKeys) {
                                    const leftDateWrap = document.createElement('div');
                                    leftDateWrap.className = '';
                                    const leftDateInput = document.createElement('input');
                                    leftDateInput.type = 'text';
                                    leftDateInput.disabled = true;
                                    leftDateInput.value = 'Date';
                                    leftDateInput.className = 'input input-bordered w-full input-sm bg-base-100';
                                    leftDateWrap.appendChild(leftDateInput);
                                    modalFilterKeys.appendChild(leftDateWrap);
                                }
                                if (modalFilterValues) {
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
                                    if (currentFilters && currentFilters.createdAt) { dateInput.value = formatDateYYYYMMDD(currentFilters.createdAt); }
                                    rightDateWrap.appendChild(dateInput);
                                    modalFilterValues.appendChild(rightDateWrap);
                                }

                                // keys as disabled inputs and corresponding filter inputs
                                currentVisibleKeys.forEach((k) => {
                                    if (modalFilterKeys) {
                                        const leftWrap = document.createElement('div');
                                        leftWrap.className = '';
                                        const leftInput = document.createElement('input');
                                        leftInput.type = 'text';
                                        leftInput.disabled = true;
                                        leftInput.className = 'input input-bordered w-full input-sm bg-base-100';
                                        leftInput.value = activeTpl[k] || k;
                                        leftWrap.appendChild(leftInput);
                                        modalFilterKeys.appendChild(leftWrap);
                                    }
                                    if (modalFilterValues) {
                                        const rightWrap = document.createElement('div');
                                        rightWrap.className = '';
                                        const input = document.createElement('input');
                                        input.type = 'text';
                                        input.dataset.key = k;
                                        input.name = `filter[${k}]`;
                                        input.className = 'input input-bordered w-full input-sm';
                                        if (currentFilters && typeof currentFilters[k] !== 'undefined') { input.value = currentFilters[k]; }
                                        rightWrap.appendChild(input);
                                        modalFilterValues.appendChild(rightWrap);
                                    }
                                });

                                // sync scroll between columns
                                try {
                                    modalFilterKeys.style.overflow = 'auto';
                                    modalFilterKeys.style.maxHeight = '320px';
                                    modalFilterValues.style.overflow = 'auto';
                                    modalFilterValues.style.maxHeight = '320px';
                                    let syncing = false;
                                    modalFilterKeys.addEventListener('scroll', () => {
                                        if (syncing) { return; }
                                        syncing = true;
                                        modalFilterValues.scrollTop = modalFilterKeys.scrollTop;
                                        requestAnimationFrame(() => { syncing = false; });
                                    });
                                    modalFilterValues.addEventListener('scroll', () => {
                                        if (syncing) { return; }
                                        syncing = true;
                                        modalFilterKeys.scrollTop = modalFilterValues.scrollTop;
                                        requestAnimationFrame(() => { syncing = false; });
                                    });
                                } catch (e) { /* ignore */ }
                            }

                            try { modalFilter.showModal(); } catch (e) { try { modalFilter.classList.remove('none'); } catch (err) { /* ignore */ } }
                        };
                        btnFilter.addEventListener('click', btnFilter._listener);
                    }

                    // Cancel: clear inputs, reset filters and reload
                    if (modalFilterCancel) {
                        modalFilterCancel.removeEventListener('click', modalFilterCancel._listener || (() => { }));
                        modalFilterCancel._listener = (ev) => {
                            ev.preventDefault();
                            try {
                                const d = document.getElementById('modal_filter_date');
                                if (d) { d.value = ''; }
                            } catch (e) { /* ignore */ }
                            try {
                                const vals = modalFilterValues ? Array.from(modalFilterValues.querySelectorAll('input[data-key]')) : [];
                                vals.forEach((inp) => { inp.value = ''; });
                            } catch (e) { /* ignore */ }
                            currentFilters = {};
                            if (btnFilter) {
                                btnFilter.classList.remove('btn-info');
                                btnFilter.classList.remove('btn-warning');
                            }
                            try { modalFilter.close(); } catch (e) { try { modalFilter.classList.add('none'); } catch (err) { /* ignore */ } }
                            try { fetchPage(1); } catch (e) { /* ignore */ }
                        };
                        modalFilterCancel.addEventListener('click', modalFilterCancel._listener);
                    }

                    // Clear button: empty inputs but keep modal open
                    if (modalFilterClear) {
                        modalFilterClear.removeEventListener('click', modalFilterClear._listener || (() => { }));
                        modalFilterClear._listener = (ev) => {
                            ev.preventDefault();
                            try {
                                const d = document.getElementById('modal_filter_date');
                                if (d) { d.value = ''; }
                            } catch (e) { /* ignore */ }
                            try {
                                const vals = modalFilterValues ? Array.from(modalFilterValues.querySelectorAll('input[data-key]')) : [];
                                vals.forEach((inp) => { inp.value = ''; });
                            } catch (e) { /* ignore */ }
                        };
                        modalFilterClear.addEventListener('click', modalFilterClear._listener);
                    }

                    // Apply (form submit)
                    if (modalFilterForm) {
                        modalFilterForm.removeEventListener('submit', modalFilterForm._listener || (() => { }));
                        modalFilterForm._listener = (ev) => {
                            ev.preventDefault();
                            const filters = {};
                            try {
                                const d = document.getElementById('modal_filter_date');
                                if (d && d.value) { filters.createdAt = d.value; }
                            } catch (e) { /* ignore */ }
                            try {
                                const vals = modalFilterValues ? Array.from(modalFilterValues.querySelectorAll('input[data-key]')) : [];
                                vals.forEach((inp) => {
                                    const k = inp.dataset.key;
                                    if (!k) { return; }
                                    const v = inp.value ? String(inp.value).trim() : '';
                                    if (v !== '') { filters[k] = v; }
                                });
                            } catch (e) { /* ignore */ }
                            currentFilters = filters;
                            try {
                                if (btnFilter) {
                                    if (currentFilters && Object.keys(currentFilters).length) {
                                        btnFilter.classList.add('btn-info');
                                        btnFilter.classList.remove('btn-warning');
                                    } else {
                                        btnFilter.classList.remove('btn-success');
                                        btnFilter.classList.remove('btn-warning');
                                    }
                                }
                            } catch (e) { /* ignore */ }
                            try { modalFilter.close(); } catch (e) { modalFilter.classList.add('none'); }
                            fetchPage(1);
                        };
                        modalFilterForm.addEventListener('submit', modalFilterForm._listener);
                    }
                } catch (e) { /* ignore missing DOM */ }

            } else {
                // hide button and clear modal
                if (btnOpenTemplate) { btnOpenTemplate.classList.add('none'); }
                if (modalForm) { modalForm.action = '#'; }
                clearModalContainers();
                // hide table-level actions and clear inbox table
                if (tableActions) { tableActions.classList.add('none'); }
                const inboxHead = document.getElementById('inbox_table_head');
                const inboxBody = document.getElementById('inbox_table_body');
                if (inboxHead) { inboxHead.innerHTML = ''; }
                if (inboxBody) { inboxBody.innerHTML = ''; }
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
            if (deleteBtn) { deleteBtn.classList.add('none'); }
            if (copyBtn) { copyBtn.classList.add('none'); }
            if (h4) { h4.classList.add('opacity-25'); }
            if (codeWrap) { codeWrap.classList.add('opacity-25'); }
            if (codeEl) { codeEl.textContent = ''; }
            // hide table actions and clear inbox table when nothing is selected
            if (tableActions) { tableActions.classList.add('none'); }
            const inboxHeadInit = document.getElementById('inbox_table_head');
            const inboxBodyInit = document.getElementById('inbox_table_body');
            if (inboxHeadInit) { inboxHeadInit.innerHTML = ''; }
            if (inboxBodyInit) { inboxBodyInit.innerHTML = ''; }
        }
    });

    // Copy-to-clipboard for info_form_code via button
    const copyBtn = document.getElementById('btn_copy_code');
    if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const codeEl = document.getElementById('info_form_code');
            if (!codeEl) { return; }
            const text = codeEl.textContent.trim();
            if (!text) { return; }

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
