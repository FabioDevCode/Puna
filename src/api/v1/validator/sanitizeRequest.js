import xss from 'xss';

function sanitizeValue(value) {
    if (typeof value === 'string') {
        return xss(value);
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = sanitizeValue(v);
        }
        return out;
    }
    return value;
}

export function sanitizeRequestBody(req, res, next) {
    try {
        if (req.body && typeof req.body === 'object') {
            req.sanitizedBody = sanitizeValue(req.body);
        } else {
            req.sanitizedBody = req.body;
        }
        return next();
    } catch (err) {
        return res.status(400).json({ error: 'Invalid request body' });
    }
}

export default sanitizeRequestBody;
