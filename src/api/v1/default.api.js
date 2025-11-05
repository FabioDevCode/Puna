import express from 'express';
const router = express.Router();
import { sendHandler } from './handler/default.handler.js';
import { authApiKeyAccess } from "./middlewares/authApiKeyAccess.js";
import { sanitizeRequestBody } from './validator/sanitizeRequest.js';

// Order: auth (check headers & attach req.site/req.form) -> sanitize body -> handler
router.post('/send/:code', authApiKeyAccess, sanitizeRequestBody, sendHandler);


export default router;