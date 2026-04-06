import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: 'html',
    globalSetup: './tests/e2e/global-setup.js',

    use: {
        baseURL: 'http://localhost:3099',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        locale: 'fr-FR',
    },

    projects: [
        // Setup project: authenticate users and save storage state
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
            dependencies: ['setup'],
        },
    ],

    webServer: {
        command: 'node --env-file=.env.test scripts/seed-e2e.js && node --env-file=.env.test server.js',
        url: 'http://localhost:3099/dp-login',
        reuseExistingServer: false,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
