import express from 'express';
const router = express.Router();
import { sendHandler } from './handler/default.handler.js';
import { authApiKeyAccess } from "./middlewares/authApiKeyAccess.js";

router.post('/send/:code', authApiKeyAccess, sendHandler);


export default router;