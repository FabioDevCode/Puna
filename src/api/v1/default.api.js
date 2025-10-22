import express from 'express';
const router = express.Router();
import { sendHandler } from './handler/default.handler.js';


router.post('/send/:code', sendHandler);


export default router;