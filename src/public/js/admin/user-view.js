document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal_delete_user');
    const form = document.getElementById('formDeleteUser');
    const passwordInput = document.getElementById('delete_user_password');
    const confirmBtn = document.getElementById('confirmDeleteUserBtn');
    const userIdInput = document.getElementById('user_delete_id');
    const userLoginSpan = document.getElementById('delete_user_login');
    const deleteBtn = document.getElementById('deleteUserBtn');

    if (!modal || !passwordInput || !confirmBtn || !deleteBtn) return;

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
});
