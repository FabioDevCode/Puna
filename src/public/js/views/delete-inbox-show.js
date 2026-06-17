(function () {
    if (window.__deleteInboxShowInit) return;
    window.__deleteInboxShowInit = true;

    try {
        const btnDelete = document.getElementById('btn_delete_inbox_show');
        const modal = document.getElementById('modal_delete_inbox_show');

        if (btnDelete && modal) {
            btnDelete.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    modal.showModal();
                } catch (err) {
                    console.error(err);
                }
            });
        }
    } catch (_e) {
        // silent
    }
})();
