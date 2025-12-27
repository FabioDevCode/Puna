function yearSelectPlugin(config = {}) {
	const defaultOptions = {
		range: 4,
		minYear: null,
		maxYear: null,
		currentYear: null
	};

	const options = Object.assign({}, defaultOptions, config);

	return function (fp) {
		let currentViewYear = options.currentYear ? options.currentYear : new Date().getFullYear();
		let minYear, maxYear;

		const actualYear = currentViewYear;
		console.log("actualYear : ", actualYear);


		if (options.minYear !== null) minYear = options.minYear;
		else minYear = currentViewYear - options.range;

		if (options.maxYear !== null) maxYear = options.maxYear;
		else maxYear = currentViewYear + options.range;

		const yearsPerPage = 9;
		let container, grid, prevBtn, nextBtn;

		function renderYearGrid(startYear) {
			grid.innerHTML = "";

			for (let i = 0; i < yearsPerPage; i++) {
				const year = startYear + i;
				if (year < minYear || year > maxYear) continue;

				const btn = document.createElement("button");
				btn.className = "year-button";
				btn.textContent = year;
				btn.dataset.year = year;

				console.log(actualYear);

				if (year === actualYear) {
					btn.classList.add("actual");
				}

				btn.addEventListener("click", () => {
					fp.setDate(new Date(year, 0, 1));
					fp.close();
				});

				grid.appendChild(btn);
			}
		}

		function buildPickerElements() {
			container = document.createElement("div");
			container.className = "flatpickr-year-select";

			const nav = document.createElement("div");
			nav.className = "year-nav";

			prevBtn = document.createElement("button");
			prevBtn.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 17 17"><g></g><path d="M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z"></path></svg>';
			prevBtn.className = "year-nav-btn";
			prevBtn.addEventListener("click", () => {
				currentViewYear = Math.max(minYear, currentViewYear - yearsPerPage);
				renderYearGrid(currentViewYear);
			});

			nextBtn = document.createElement("button");
			nextBtn.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 17 17"><g></g><path d="M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z"></path></svg>';
			nextBtn.className = "year-nav-btn";
			nextBtn.addEventListener("click", () => {
				currentViewYear = Math.min(maxYear - yearsPerPage + 1, currentViewYear + yearsPerPage);
				renderYearGrid(currentViewYear);
			});

			nav.appendChild(prevBtn);
			nav.appendChild(nextBtn);

			grid = document.createElement("div");
			grid.className = "year-grid";

			container.appendChild(nav);
			container.appendChild(grid);
		}

		return {
			onReady(_, __, fpInstance) {
				buildPickerElements();

				const monthsContainer = fp.calendarContainer.querySelector(".flatpickr-months");
				if (monthsContainer) monthsContainer.style.display = "none";

				const customContainer = fp._createElement("div", "flatpickr-custom-container", "");
				customContainer.appendChild(container);

				const rContainer = fp.calendarContainer.querySelector(".flatpickr-rContainer");
				if (rContainer) {
					rContainer.innerHTML = "";
					rContainer.appendChild(customContainer);
				} else {
					fp.calendarContainer.appendChild(customContainer);
				}

				const actualYear = options.currentYear ? options.currentYear : new Date().getFullYear();
				currentViewYear = Math.max(minYear, actualYear - yearsPerPage);
				renderYearGrid(currentViewYear);
			},
			onOpen() {
				renderYearGrid(currentViewYear);
			},
			onDestroy() {
				const months = fp.calendarContainer.querySelector(".flatpickr-months");
				if (months) months.style.display = "";
			}
		};
	};
}