import { describe, expect, it } from 'vitest';
import { getFileTypeInfo } from '../../../src/helpers/file.helpers.js';

describe('getFileTypeInfo', () => {
    describe('invalid / missing filename', () => {
        it('returns default icon for null input', () => {
            const result = getFileTypeInfo(null);
            expect(result.icon).toBe('fa-solid fa-file');
            expect(result.bg_color).toBe('#1F2937');
            expect(result.color).toBe('white');
            expect(result.label).toBe('FILE');
        });

        it('returns default icon for undefined input', () => {
            const result = getFileTypeInfo(undefined);
            expect(result.icon).toBe('fa-solid fa-file');
            expect(result.label).toBe('FILE');
        });

        it('returns default icon for non-string input (number)', () => {
            const result = getFileTypeInfo(42);
            expect(result.icon).toBe('fa-solid fa-file');
        });

        it('returns default fallback with uppercased extension for unknown extension', () => {
            const result = getFileTypeInfo('report.xyz');
            expect(result.icon).toBe('fa-solid fa-file');
            expect(result.bg_color).toBe('#1F2937');
            expect(result.label).toBe('XYZ');
        });
    });

    describe('image files', () => {
        const imageCases = ['photo.png', 'image.jpg', 'image.jpeg', 'banner.webp', 'animation.gif', 'logo.svg', 'icon.bmp', 'favicon.ico'];

        it.each(imageCases)('returns image metadata for %s', (filename) => {
            const result = getFileTypeInfo(filename);
            expect(result.icon).toBe('fa-solid fa-file-image');
            expect(result.bg_color).toBe('#b0a010');
            expect(result.color).toBe('white');
        });

        it('label is the uppercased extension', () => {
            expect(getFileTypeInfo('photo.png').label).toBe('PNG');
            expect(getFileTypeInfo('image.jpg').label).toBe('JPG');
        });
    });

    describe('Excel files', () => {
        it('returns Excel metadata for .xls', () => {
            const result = getFileTypeInfo('data.xls');
            expect(result.icon).toBe('fa-solid fa-file-excel');
            expect(result.bg_color).toBe('#186E3F');
            expect(result.label).toBe('XLS');
        });

        it('returns Excel metadata for .xlsx', () => {
            const result = getFileTypeInfo('data.xlsx');
            expect(result.icon).toBe('fa-solid fa-file-excel');
            expect(result.label).toBe('XLSX');
        });
    });

    describe('CSV files', () => {
        it('returns CSV metadata for .csv', () => {
            const result = getFileTypeInfo('export.csv');
            expect(result.icon).toBe('fa-solid fa-file-csv');
            expect(result.bg_color).toBe('#077D3E');
            expect(result.label).toBe('CSV');
        });
    });

    describe('PDF files', () => {
        it('returns PDF metadata for .pdf', () => {
            const result = getFileTypeInfo('document.pdf');
            expect(result.icon).toBe('fa-solid fa-file-pdf');
            expect(result.bg_color).toBe('#AA0101');
            expect(result.label).toBe('PDF');
        });
    });

    describe('Word files', () => {
        it('returns Word metadata for .doc', () => {
            const result = getFileTypeInfo('letter.doc');
            expect(result.icon).toBe('fa-solid fa-file-word');
            expect(result.bg_color).toBe('#2A5893');
            expect(result.label).toBe('DOC');
        });

        it('returns Word metadata for .docx', () => {
            const result = getFileTypeInfo('letter.docx');
            expect(result.icon).toBe('fa-solid fa-file-word');
            expect(result.label).toBe('DOCX');
        });
    });

    describe('ODT files', () => {
        it('returns ODT metadata for .odt', () => {
            const result = getFileTypeInfo('text.odt');
            expect(result.icon).toBe('fa-solid fa-file-lines');
            expect(result.bg_color).toBe('#4A90E2');
            expect(result.label).toBe('ODT');
        });
    });

    describe('TXT files', () => {
        it('returns TXT metadata for .txt', () => {
            const result = getFileTypeInfo('notes.txt');
            expect(result.icon).toBe('fa-solid fa-file-lines');
            expect(result.bg_color).toBe('#444444');
            expect(result.label).toBe('TXT');
        });
    });

    describe('Archive files', () => {
        const archiveCases = [
            ['archive.zip', 'ZIP'],
            ['archive.rar', 'RAR'],
            ['archive.7z', '7Z'],
            ['archive.tar', 'TAR'],
            ['archive.gz', 'GZ'],
        ];

        it.each(archiveCases)('returns archive metadata for %s', (filename, expectedLabel) => {
            const result = getFileTypeInfo(filename);
            expect(result.icon).toBe('fa-solid fa-file-zipper');
            expect(result.bg_color).toBe('#6B46C1');
            expect(result.label).toBe(expectedLabel);
        });
    });

    describe('case-insensitive extension matching', () => {
        it('handles uppercase extensions', () => {
            const result = getFileTypeInfo('PHOTO.PNG');
            expect(result.icon).toBe('fa-solid fa-file-image');
        });

        it('handles mixed-case extensions', () => {
            const result = getFileTypeInfo('document.PDF');
            expect(result.icon).toBe('fa-solid fa-file-pdf');
        });
    });
});
