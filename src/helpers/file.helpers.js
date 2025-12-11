/**
 * Détermine le type de fichier et retourne les métadonnées pour l'affichage
 * @param {string} filename - Le nom du fichier
 * @returns {Object} Métadonnées du fichier (color, bg_color, icon, label)
 */
const getFileTypeInfo = (filename) => {
    if (!filename || typeof filename !== 'string') {
        return {
            color: 'white',
            bg_color: '#1F2937',
            icon: 'fa-solid fa-file',
            label: 'FILE',
        };
    }

    const ext = filename.toLowerCase().split('.').pop();

    // Images - Jaune/Or
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#b0a010',
            icon: 'fa-solid fa-file-image',
            label: ext.toUpperCase(),
        };
    }

    // Excel - Vert foncé
    if (['xls', 'xlsx'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#186E3F',
            icon: 'fa-solid fa-file-excel',
            label: ext.toUpperCase(),
        };
    }

    // CSV - Vert
    if (['csv'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#077D3E',
            icon: 'fa-solid fa-file-csv',
            label: ext.toUpperCase(),
        };
    }

    // PDF - Rouge
    if (ext === 'pdf') {
        return {
            color: 'white',
            bg_color: '#AA0101',
            icon: 'fa-solid fa-file-pdf',
            label: 'PDF',
        };
    }

    // Word - Bleu foncé
    if (['doc', 'docx'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#2A5893',
            icon: 'fa-solid fa-file-word',
            label: ext.toUpperCase(),
        };
    }

    // ODT - Bleu clair
    if (['odt'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#4A90E2',
            icon: 'fa-solid fa-file-lines',
            label: ext.toUpperCase(),
        };
    }

    // TXT - Gris foncé
    if (['txt'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#444444',
            icon: 'fa-solid fa-file-lines',
            label: ext.toUpperCase(),
        };
    }

    // ZIP/Archives - Violet
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return {
            color: 'white',
            bg_color: '#6B46C1',
            icon: 'fa-solid fa-file-zipper',
            label: ext.toUpperCase(),
        };
    }

    // Fichier par défaut - Gris
    return {
        color: 'white',
        bg_color: '#1F2937',
        icon: 'fa-solid fa-file',
        label: ext.toUpperCase(),
    };
};

export { getFileTypeInfo };
