import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json'],
            reportsDirectory: './coverage',
        },
        server: {
            deps: {
                // Load node-cron via native Node.js instead of Vite's transform
                // pipeline, avoiding the "missing source files" sourcemap warning.
                external: ['node-cron'],
            },
        },
    },
});
