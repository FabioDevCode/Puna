document.addEventListener('DOMContentLoaded', () => {
	// Tooltip helpers for inbox long-content preview
	let _inboxTooltipEl = null;
	function ensureInboxTooltip() {
		if (_inboxTooltipEl) return _inboxTooltipEl;
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
		if (!_inboxTooltipEl) return;
		_inboxTooltipEl.classList.add('none');
	}

	// Find all tab containers (daisyui uses .tabs)
	const tabLists = document.querySelectorAll('.tabs');

	tabLists.forEach((tabList) => {
		// Delegate clicks on tabs
		tabList.addEventListener('click', (e) => {
			const target = e.target.closest('[role="tab"], .tab');
			if (!target || !tabList.contains(target)) return;
			e.preventDefault();

			// Remove active state from all tabs in this list
			const tabs = Array.from(tabList.querySelectorAll('[role="tab"], .tab'));
			tabs.forEach((t) => {
				t.classList.remove('tab-active');
				t.setAttribute('aria-selected', 'false');
			});

			// Set active on clicked tab
			target.classList.add('tab-active');
			target.setAttribute('aria-selected', 'true');

			// Compute helper values used in multiple places
			const hasId = !!(target.dataset && target.dataset.id);

			// Update the info panel fields (name, code, delete input) — panel DOM now lives in `site_show.hbs`
			const infoPanel = document.getElementById('info_form_panel');
			if (infoPanel) {
				const name = target.dataset.name || 'Formulaire';
				const code = target.dataset.code || '';

				// Update title
				const h4 = document.getElementById('info_form_name');
				if (h4) {
					h4.textContent = name;
					if (hasId) h4.classList.remove('opacity-25'); else h4.classList.add('opacity-25');
				}

				// Set delete form id in modal hidden input (empty if none) and toggle delete button visibility
				const deleteInput = document.getElementById('form_delete_id');
				const deleteBtn = document.getElementById('btn_delete_form');
				if (deleteInput) deleteInput.value = target.dataset.id || '';
				if (deleteBtn) {
					if (hasId) deleteBtn.classList.remove('none');
					else deleteBtn.classList.add('none');
				}

				// Update code and toggle opacity + copy icon visibility
				const codeEl = document.getElementById('info_form_code');
				const codeWrap = document.getElementById('info_form_code_wrap');
				const copyBtn = document.getElementById('btn_copy_code');
				if (codeEl) codeEl.textContent = code;
				if (codeWrap) {
					if (hasId) codeWrap.classList.remove('opacity-25'); else codeWrap.classList.add('opacity-25');
				}
				if (copyBtn) {
					if (hasId) copyBtn.classList.remove('none');
					else copyBtn.classList.add('none');
				}
			}

			// Also update the template modal/button
			const btnOpenTemplate = document.getElementById('btn_open_template');
			const modalForm = document.getElementById('modal_template_form');
			const keysContainer = document.getElementById('modal_template_keys');
			const valuesContainer = document.getElementById('modal_template_values');

			function clearModalContainers() {
				if (keysContainer) keysContainer.innerHTML = '';
				if (valuesContainer) valuesContainer.innerHTML = '';
			}

			if (hasId) {
				// show button
				if (btnOpenTemplate) btnOpenTemplate.classList.remove('none');
				// set form action
				if (modalForm) modalForm.action = `/form/${target.dataset.id}/template`;
				// populate modal content from data-template attribute
				let tpl = {};
				try {
					const raw = target.dataset.template || '';
					if (raw) tpl = JSON.parse(raw);
				} catch (e) {
					tpl = {};
				}

				clearModalContainers();
				const keys = Object.keys(tpl || {});
				if (!keys.length) {
					if (keysContainer) keysContainer.innerHTML = '<p class="text-sm text-muted">Aucune clé définie pour ce formulaire.</p>';
					if (valuesContainer) valuesContainer.innerHTML = '';
				} else {
					keys.forEach((k) => {
						// left: key
						const d = document.createElement('div');
						d.className = 'px-2 py-1 rounded h-[32px] bg-neutral-content/50 text-sm bg-base-100';
						d.textContent = k;
						keysContainer.appendChild(d);

						// right: input
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

				// Also fetch and render inbox rows for this form
				const inboxHead = document.getElementById('inbox_table_head');
				const inboxBody = document.getElementById('inbox_table_body');

				function clearInbox() {
					if (inboxHead) inboxHead.innerHTML = '';
					if (inboxBody) inboxBody.innerHTML = '';
					// reset counter display
					const countEl = document.getElementById('count_inbox');
					if (countEl) countEl.textContent = '';
				}

				// build header row based on template keys
				function buildHead(keysArr) {
					if (!inboxHead) return;
					const tr = document.createElement('tr');

					// const thCheck = document.createElement('th');
					// thCheck.innerHTML = '<label><input type="checkbox" class="checkbox" /></label>';
					// tr.appendChild(thCheck);

					// Always add a Date column after the checkbox
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
					if (!inboxBody) return;
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
							try {
								const d = new Date(it.createdAt);
								tdDate.textContent = d.toLocaleString();
							} catch (e) {
								tdDate.textContent = it.createdAt;
							}
						} else {
							tdDate.textContent = ' - ';
						}

						tr.appendChild(tdDate);

						// Helper to render a cell with optional truncation + tooltip
						function renderCell(value) {
							const td = document.createElement('td');
							const str = value !== undefined && value !== null ? String(value) : '';
							const MAX = 100;
							if (str.length > MAX) {
								// truncated preview
								td.textContent = str.substring(0, MAX) + '...';
								td.classList.add('inbox-cell-truncated');

								// show tooltip box near mouse with full content
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
						tdAct.innerHTML = `<button class="btn btn-sm btn-neutral btn-outline btn-circle noo pt-[2px]">
							<i class="fa-solid fa-ellipsis"></i>
						</button>`;
						tr.appendChild(tdAct);


						inboxBody.appendChild(tr);
					});
				}

				// Fetch inbox
				clearInbox();

				fetch(`/form/${target.dataset.id}/inbox`, { credentials: 'same-origin' })
				.then((r) => r.json())
				.then((data) => {
					const items = data.items || [];
						if(items?.length) {
							buildHead(keys);
							buildRows(items, keys);
										// show table-level buttons
							const tableBtns = document.getElementById('tableBtns');
							if (tableBtns) tableBtns.classList.remove('none');
						}

						const countEl = document.getElementById('count_inbox');
						if (countEl) {
							const n = items.length || 0;
							const word = n === 1 ? 'élément' : 'éléments';
							const result = n === 0 ? "" : `${n} ${word}`;
							countEl.textContent = result;
						}
				})
				.catch(() => {
					clearInbox();
				});

			} else {
				// hide button and clear modal
				if (btnOpenTemplate) btnOpenTemplate.classList.add('none');
				if (modalForm) modalForm.action = '#';
				clearModalContainers();
				// hide table-level buttons and clear inbox table
				const tableBtns = document.getElementById('tableBtns');
				if (tableBtns) tableBtns.classList.add('none');
				const inboxHead = document.getElementById('inbox_table_head');
				const inboxBody = document.getElementById('inbox_table_body');
				if (inboxHead) inboxHead.innerHTML = '';
				if (inboxBody) inboxBody.innerHTML = '';
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
			if (deleteBtn) deleteBtn.classList.add('none');
			if (copyBtn) copyBtn.classList.add('none');
			if (h4) h4.classList.add('opacity-25');
			if (codeWrap) codeWrap.classList.add('opacity-25');
			if (codeEl) codeEl.textContent = '';
			// hide table buttons and clear inbox table when nothing is selected
			const tableBtns = document.getElementById('tableBtns');
			if (tableBtns) tableBtns.classList.add('none');
			const inboxHeadInit = document.getElementById('inbox_table_head');
			const inboxBodyInit = document.getElementById('inbox_table_body');
			if (inboxHeadInit) inboxHeadInit.innerHTML = '';
			if (inboxBodyInit) inboxBodyInit.innerHTML = '';
		}
	});

	// Copy-to-clipboard for info_form_code via button
	const copyBtn = document.getElementById('btn_copy_code');
	if (copyBtn) {
		copyBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			const codeEl = document.getElementById('info_form_code');
			if (!codeEl) return;
			const text = codeEl.textContent.trim();
			if (!text) return;

			try {
				await navigator.clipboard.writeText(text);
				// temporary feedback: change button text/icon like token.js but without green color
				const old = copyBtn.innerHTML;
				copyBtn.innerHTML = '<i class="fas fa-check"></i> Code copié';
				setTimeout(() => { copyBtn.innerHTML = old; }, 1200);
			} catch (err) {
				// ignore copy errors silently
			}
		});
	}
});