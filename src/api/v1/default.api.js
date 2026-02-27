import express from 'express';
import { sendHandler } from './handlers/default.handler.js';
import { authApiKeyAccess } from './middlewares/authApiKeyAccess.js';
import inspectArchive from './middlewares/inspectArchive.js';
import moveFilesToUploads from './middlewares/moveFilesToUploads.js';
import { multipartUpload } from './middlewares/multipartUpload.js';
import { formRateLimiter } from './middlewares/rateLimiter.js';
import scanUpload from './middlewares/scanUpload.js';
import updateFormFileKeys from './middlewares/updateFormFileKeys.js';
import { updateFormTemplate } from './middlewares/updateFormTemplate.js';
import validateUpload from './middlewares/validateUpload.js';
import { sanitizeRequestBody } from './validators/sanitizeRequest.js';

const router = express.Router();

router.post(
    '/send/:code',
    authApiKeyAccess,
    formRateLimiter,
    multipartUpload,
    validateUpload,
    inspectArchive,
    scanUpload,
    moveFilesToUploads,
    updateFormFileKeys,
    sanitizeRequestBody,
    updateFormTemplate,
    sendHandler
);

export default router;
