import { apiLogger } from '../../../config/logger.js';
import models from '../../../models/index.js';

export async function sendHandler(req, res) {
    const { form } = req;

    try {
        // Persist sanitized payload in Inbox.content as a JSON string
        // req.sanitizedBody is provided by the sanitizeRequestBody middleware
        const payload = req.sanitizedBody !== undefined ? req.sanitizedBody : req.body;

        // Ensure we have a form reference
        const fk_id_form = form && form.id ? form.id : null;
        if (!fk_id_form) {
            return res.status(400).json({ success: false, error: 'Form id missing' });
        }

        // Save into Inbox
        await models.Inbox.create({
            content: JSON.stringify(payload),
            fk_id_form: fk_id_form,
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        apiLogger.error({ error: err.message, stack: err.stack }, 'Error in sendHandler');
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
