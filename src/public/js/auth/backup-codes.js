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
                    text: 'Codes copiés dans le presse-papier.',
                    type: 'success',
                });
            })
            .catch(function () {
                Toast({
                    text: 'Impossible de copier les codes. Veuillez les copier manuellement.',
                    type: 'error',
                });
            });
    });

    document.getElementById('btn-download-codes').addEventListener('click', function () {
        var text = getBackupCodes().join('\n');
        var blob = new Blob([text], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'puna-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
})();
