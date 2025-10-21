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

			// If the clicked tab has form data, update the info panel
			const infoPanel = document.getElementById('info_form_panel');
			if (infoPanel && target.dataset && target.dataset.name) {
				const name = target.dataset.name || '';
				const code = target.dataset.code || '';
				const template = target.dataset.template || '';

				// Update title
				const h4 = infoPanel.querySelector('h4');
				if (h4) h4.textContent = name || 'Formulaire';

				// Update code
				const codeEl = infoPanel.querySelector('#info_form_code');
				if (codeEl) codeEl.textContent = code;

				// Placeholder for template - keep commented in DOM for later
				// const tplEl = infoPanel.querySelector('.template-area');
				// if (tplEl) tplEl.textContent = template;
			}
		});

		// Initialize panel from any active tab on load
		const active = tabList.querySelector('.tab-active[data-name], [role="tab"].tab-active[data-name]');
		if (active) {
			active.click();
		}
	});
});