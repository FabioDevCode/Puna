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


router.post(
    '/send/:code',
    authApiKeyAccess,
    multipartUpload,
    validateUpload,
    inspectArchive,
    moveFilesToUploads,
    updateFormFileKeys,
    sanitizeRequestBody,
    updateFormTemplate,
    sendHandler
);


export default router;