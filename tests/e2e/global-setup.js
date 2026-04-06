/**
 * Playwright global setup.
 * DB seeding is handled by the webServer command (seed then start).
 * This file is kept for future global setup needs (e.g., env checks).
 */

export default async function globalSetup() {
    // Seeding is done in the webServer command:
    // node --env-file=.env.test scripts/seed-e2e.js && node --env-file=.env.test server.js
}
