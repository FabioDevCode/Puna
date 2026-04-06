/**
 * Flash message helpers for E2E tests.
 */

/**
 * Wait for flash messages to appear in the page and check content.
 * Flash messages are rendered as Toastify toasts.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedType - e.g. 'success', 'error', 'warning'
 * @param {string} [textContains] - optional substring to match in the toast text
 * @param {{ timeout?: number }} opts
 */
export async function expectFlash(page, expectedType, textContains, { timeout = 5000 } = {}) {
    // Strategy 1: read the data attribute (available immediately after navigation)
    const flashEl = page.locator('#flash-messages');
    const raw = await flashEl.getAttribute('data-flash-messages').catch(() => '[]');
    let messages = [];
    try {
        messages = JSON.parse(raw || '[]');
    } catch {
        messages = [];
    }

    if (messages.length > 0) {
        const match = messages.find((m) => m.type === expectedType && (!textContains || (m.text && m.text.includes(textContains))));
        if (match) return match;
    }

    // Strategy 2: wait for a toastify element to appear
    const toastSelector = textContains ? `.toastify:has-text("${textContains}")` : '.toastify';
    await page.locator(toastSelector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Assert no flash message of a given type is present.
 * @param {import('@playwright/test').Page} page
 * @param {string} type
 */
export async function expectNoFlash(page, type) {
    const raw = await page
        .locator('#flash-messages')
        .getAttribute('data-flash-messages')
        .catch(() => '[]');
    const messages = JSON.parse(raw || '[]');
    const found = messages.find((m) => m.type === type);
    if (found) {
        throw new Error(`Expected no flash of type "${type}" but found: ${JSON.stringify(found)}`);
    }
}
