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

    // Images - Violet
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
        return {
            color: '#6B46C1',
            bg_color: '#e8e0fb',
            icon: 'fa-solid fa-file-image',
            label: ext.toUpperCase(),
        };
    }

    // Excel - Vert foncé
    if (['xls', 'xlsx'].includes(ext)) {
        return {
            color: '#186E3F',
            bg_color: '#cef8e2',
            icon: 'fa-solid fa-file-excel',
            label: ext.toUpperCase(),
        };
    }

    // CSV - Vert
    if (['csv'].includes(ext)) {
        return {
            color: '#077D3E',
            bg_color: '#d3f8e6',
            icon: 'fa-solid fa-file-csv',
            label: ext.toUpperCase(),
        };
    }

    // PDF - Rouge
    if (ext === 'pdf') {
        return {
            color: '#AA0101',
            bg_color: '#f8dfdf',
            icon: 'fa-solid fa-file-pdf',
            label: 'PDF',
        };
    }

    // PowerPoint - Rouge
    if (['pptx', 'ppt'].includes(ext)) {
        return {
            color: '#bf0b0b',
            bg_color: '#fcd9d9',
            icon: 'fa-solid fa-file-powerpoint',
            label: ext.toUpperCase(),
        };
    }

    // Audio - Turquoise/bleu-vert
    if (['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'].includes(ext)) {
        return {
            color: '#049c80',
            bg_color: '#d5fbf8',
            icon: 'fa-solid fa-file-audio',
            label: ext.toUpperCase(),
        };
    }

    // Video - Violet/bleu
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'mpeg', 'mpg'].includes(ext)) {
        return {
            color: '#34049c',
            bg_color: '#e4d9fa',
            icon: 'fa-solid fa-file-video',
            label: ext.toUpperCase(),
        };
    }

    // Word - Bleu foncé
    if (['doc', 'docx'].includes(ext)) {
        return {
            color: '#2A5893',
            bg_color: '#dfebf9',
            icon: 'fa-solid fa-file-word',
            label: ext.toUpperCase(),
        };
    }

    // ODT - Bleu clair
    if (['odt'].includes(ext)) {
        return {
            color: '#4A90E2',
            bg_color: '#e0edfb',
            icon: 'fa-solid fa-file-lines',
            label: ext.toUpperCase(),
        };
    }

    // TXT - Gris foncé
    if (['txt'].includes(ext)) {
        return {
            color: '#444444',
            bg_color: '#dcdbdb',
            icon: 'fa-solid fa-file-lines',
            label: ext.toUpperCase(),
        };
    }

    // ZIP/Archives - Jaune/OR
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return {
            color: '#b0a010',
            bg_color: '#f6f3d7',
            icon: 'fa-solid fa-file-zipper',
            label: ext.toUpperCase(),
        };
    }

    // Fichier par défaut - Gris
    return {
        color: '#1F2937',
        bg_color: '#c9d6e8',
        icon: 'fa-solid fa-file',
        label: ext.toUpperCase(),
    };
};

export { getFileTypeInfo };
