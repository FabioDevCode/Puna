document.addEventListener('DOMContentLoaded', () => {
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
			} else {
				// hide button and clear modal
				if (btnOpenTemplate) btnOpenTemplate.classList.add('none');
				if (modalForm) modalForm.action = '#';
				clearModalContainers();
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
				copyBtn.innerHTML = '<i class="fas fa-check"></i> Copié';
				setTimeout(() => { copyBtn.innerHTML = old; }, 1200);
			} catch (err) {
				// ignore copy errors silently
			}
		});
	}
});