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

            // If the clicked tab has form data (data-id), update the info panel and show it
            const infoPanel = document.getElementById('info_form_panel');
            if (infoPanel) {
                if (target.dataset && target.dataset.id) {
                    const name = target.dataset.name || '';
                    const code = target.dataset.code || '';
                    const template = target.dataset.template || '';

                    // Remove hidden class
                    infoPanel.classList.remove('none');

                    // Update title
					const h4 = document.getElementById('info_form_name');
					if (h4) h4.textContent = name || 'Formulaire';

					// Set delete form id in modal hidden input
					const deleteInput = document.getElementById('form_delete_id');
					if (deleteInput) deleteInput.value = target.dataset.id;

                    // Update code
                    const codeEl = infoPanel.querySelector('#info_form_code');
                    if (codeEl) codeEl.textContent = code;

                    // Placeholder for template - keep commented in DOM for later
                    // const tplEl = infoPanel.querySelector('.template-area');
                    // if (tplEl) tplEl.textContent = template;
                } else {
                    // Hide panel when clicked tab has no data-id
                    infoPanel.classList.add('none');
						// Clear delete input
						const deleteInput = document.getElementById('form_delete_id');
						if (deleteInput) deleteInput.value = '';
                }
            }
		});

		// Initialize panel from any active tab on load
		const active = tabList.querySelector('.tab-active[data-name], [role="tab"].tab-active[data-name]');
		if (active) {
			active.click();
		}
	});

	// Copy-to-clipboard for info_form_code
	const codeWrap = document.getElementById('info_form_code_wrap');
	if (codeWrap) {
		codeWrap.addEventListener('click', async (e) => {
			e.preventDefault();
			const codeEl = document.getElementById('info_form_code');
			const icon = document.getElementById('info_form_copy_icon');
			if (!codeEl) return;
			const text = codeEl.textContent.trim();
			if (!text) return;

			try {
				await navigator.clipboard.writeText(text);
				// temporary feedback: change icon to check
				if (icon) {
					const old = icon.className;
					icon.className = 'fas fa-check text-success';
					setTimeout(() => { icon.className = old; }, 800);
				}
			} catch (err) {
				// ignore copy errors silently
			}
		});
	}
});