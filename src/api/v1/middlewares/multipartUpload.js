import multer from 'multer';
import fs from 'fs';
import path from 'path';

const TMP_DIR = process.env.UPLOADS_TMP || path.join(process.cwd(), 'storage', 'tmp');
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 20 * 1024 * 1024; // 20MB

// Ensure temp dir exists
fs.mkdirSync(TMP_DIR, { recursive: true });

function sanitizeName(name) {
	return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, TMP_DIR);
	},
	filename: (req, file, cb) => {
		const ts = Date.now();
		const safe = sanitizeName(file.originalname || 'file');
		cb(null, `${ts}_${safe}`);
	}
});

const upload = multer({
	storage,
	limits: { fileSize: MAX_FILE_SIZE }
});

// We don't know field names in advance, accept any fields but enforce one-file-per-field later
export const multipartUpload = upload.any();

export default multipartUpload;
