document.addEventListener('DOMContentLoaded', () => {
    // ── Delete modal ─────────────────────────────────────────────────────────
    const modal = document.getElementById('modal_delete_user');
    const form = document.getElementById('formDeleteUser');
    const passwordInput = document.getElementById('delete_user_password');
    const confirmBtn = document.getElementById('confirmDeleteUserBtn');
    const userIdInput = document.getElementById('user_delete_id');
    const userLoginSpan = document.getElementById('delete_user_login');
    const deleteBtn = document.getElementById('deleteUserBtn');

    if (modal && passwordInput && confirmBtn && deleteBtn) {
        passwordInput.addEventListener('input', (e) => {
            confirmBtn.disabled = e.target.value.trim() === '';
        });

        modal.addEventListener('close', () => {
            passwordInput.value = '';
            confirmBtn.disabled = true;
            form.reset();
        });

        deleteBtn.addEventListener('click', () => {
            userIdInput.value = deleteBtn.dataset.userId;
            userLoginSpan.textContent = deleteBtn.dataset.userLogin;
            form.action = '/admin/users/delete';
            modal.showModal();
        });
    }

    // ── Ban modal ─────────────────────────────────────────────────────────────
    const banModal = document.getElementById('modal_ban_user');
    const banForm = document.getElementById('formBanUser');
    const banReasonInput = document.getElementById('ban_user_reason');
    const confirmBanBtn = document.getElementById('confirmBanUserBtn');
    const banUserLoginSpan = document.getElementById('ban_user_login');
    const banBtn = document.getElementById('banUserBtn');

    if (banModal && banReasonInput && confirmBanBtn && banBtn) {
        banReasonInput.addEventListener('input', (e) => {
            confirmBanBtn.disabled = e.target.value.trim() === '';
        });

        banModal.addEventListener('close', () => {
            banReasonInput.value = '';
            confirmBanBtn.disabled = true;
            banForm.reset();
        });

        banBtn.addEventListener('click', () => {
            banUserLoginSpan.textContent = banBtn.dataset.userLogin;
            banForm.action = `/admin/users/${banBtn.dataset.userId}/status`;
            banModal.showModal();
        });
    }
});
