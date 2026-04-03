(function () {
    function getBackupCodes() {
        return Array.from(document.querySelectorAll('.backup-code-item')).map(function (el) {
            return el.textContent.trim();
        });
    }

    document.getElementById('btn-copy-codes').addEventListener('click', function () {
        navigator.clipboard
            .writeText(getBackupCodes().join('\n'))
            .then(function () {
                Toast({
                    text: (window.__i18n && window.__i18n.codes_copied) || 'Codes copiés dans le presse-papier.',
                    type: 'success',
                });
            })
            .catch(function () {
                Toast({
                    text: (window.__i18n && window.__i18n.codes_copy_error) || 'Impossible de copier les codes. Veuillez les copier manuellement.',
                    type: 'error',
                });
            });
    });

    document.getElementById('btn-download-codes').addEventListener('click', function () {
        const text = getBackupCodes().join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'puna-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
})();
