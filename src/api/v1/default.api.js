import express from 'express';
const router = express.Router();
import { sendHandler } from './handlers/default.handler.js';
import { authApiKeyAccess } from "./middlewares/authApiKeyAccess.js";
import { sanitizeRequestBody } from './validators/sanitizeRequest.js';
import { updateFormTemplate } from './middlewares/updateFormTemplate.js';
import updateFormFileKeys from './middlewares/updateFormFileKeys.js';
import { multipartUpload } from './middlewares/multipartUpload.js';
import validateUpload from './middlewares/validateUpload.js';
import inspectArchive from './middlewares/inspectArchive.js';
import moveFilesToUploads from './middlewares/moveFilesToUploads.js';

// Order: auth (check headers & attach req.site/req.form) -> sanitize body -> update template -> handler
router.post('/send/:code', authApiKeyAccess, sanitizeRequestBody, updateFormTemplate, sendHandler);

// New multipart endpoint: accepts files (one file per field), validates and stores them
router.post('/send-multipart/:code', authApiKeyAccess, multipartUpload, validateUpload, inspectArchive, moveFilesToUploads, updateFormFileKeys, updateFormTemplate, sendHandler);


export default router;