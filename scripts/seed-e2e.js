/**
 * Seed script for E2E tests.
 * Run with: node --env-file=.env.test scripts/seed-e2e.js
 *
 * Creates:
 * - 4 users (super_admin, editor, viewer, pending)
 * - 1 test site with SiteUser association
 * - 1 form attached to the site
 * - 2 inbox entries for the form
 */

import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcrypt';

// Remove existing SQLite file (and WAL/SHM) to start fresh
const dbPath = path.resolve(process.env.DB_STORAGE || 'storage/test.sqlite');
for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) {
        fs.unlinkSync(f);
    }
}
console.log(`🗑️  Removed existing database: ${dbPath}`);

// Ensure storage directory exists
const storageDir = path.dirname(dbPath);
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}

// Dynamic import after env is loaded
const { default: models } = await import('../src/models/index.js');

// Force sync — recreate all tables
await models.sequelize.sync({ force: true });
console.log('✅ Database tables created');

// Disable FK constraints for SQLite during seed (self-referencing User.created_by)
if (process.env.DB_DIALECT === 'sqlite') {
    await models.sequelize.query('PRAGMA foreign_keys = OFF;');
}

// ── Password hashing ──
const SALT_ROUNDS = 10;
const TEST_PASSWORD = 'TestPassword1!E2e@';
const hashedPassword = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);

// ── Users ──
const adminUser = await models.User.create({
    login: 'admin_e2e',
    email: 'admin@e2e.test',
    password: hashedPassword,
    role: 'super_admin',
    status: 'active',
    locale: 'fr',
});
console.log(`👤 Created super_admin: admin_e2e`);

const ownerUser = await models.User.create({
    login: 'owner_e2e',
    email: 'owner@e2e.test',
    password: hashedPassword,
    role: 'owner',
    status: 'active',
    locale: 'fr',
});
console.log(`👤 Created owner: owner_e2e`);

const editorUser = await models.User.create({
    login: 'editor_e2e',
    email: 'editor@e2e.test',
    password: hashedPassword,
    role: 'editor',
    status: 'active',
    locale: 'fr',
});
console.log(`👤 Created editor: editor_e2e`);

const viewerUser = await models.User.create({
    login: 'viewer_e2e',
    email: 'viewer@e2e.test',
    password: hashedPassword,
    role: 'viewer',
    status: 'active',
    locale: 'fr',
});
console.log(`👤 Created viewer: viewer_e2e`);

await models.User.create({
    login: 'pending_e2e',
    email: 'pending@e2e.test',
    password: null,
    role: 'editor',
    status: 'pending',
    locale: 'fr',
});
console.log(`👤 Created pending user: pending_e2e`);

// ── Site ──
const { encryptString } = await import('../src/utils/crypto.js');
const controlCode = encryptString('e2e-control-test-code');

const site = await models.Site.create({
    domain: 'e2e-test.dev',
    control_code: controlCode,
});
console.log(`🌐 Created site: e2e-test.dev`);

// ── SiteUser associations ──
await models.SiteUser.create({
    fk_id_site: site.id,
    fk_id_user: adminUser.id,
});

await models.SiteUser.create({
    fk_id_site: site.id,
    fk_id_user: ownerUser.id,
});

await models.SiteUser.create({
    fk_id_site: site.id,
    fk_id_user: editorUser.id,
});

await models.SiteUser.create({
    fk_id_site: site.id,
    fk_id_user: viewerUser.id,
});
console.log(`🔗 Created SiteUser associations`);

// ── Form ──
const { default: stringUtils } = await import('../src/utils/string.js');
const form = await models.Form.create({
    name: 'Contact',
    code: stringUtils.generateCode(16),
    fk_id_site: site.id,
    template: JSON.stringify({ name: 'Nom', email: 'Email', message: 'Message' }),
    columns: JSON.stringify({ name: true, email: true, message: true }),
});
console.log(`📋 Created form: Contact`);

// ── Inbox entries ──
await models.Inbox.create({
    fk_id_form: form.id,
    content: JSON.stringify({
        name: 'Jean Dupont',
        email: 'jean@test.fr',
        message: 'Ceci est un message de test E2E',
    }),
});

await models.Inbox.create({
    fk_id_form: form.id,
    content: JSON.stringify({
        name: 'Marie Martin',
        email: 'marie@test.fr',
        message: 'Un second message pour les tests',
    }),
});
console.log(`📥 Created 2 inbox entries`);

// ── Summary ──
console.log('\n🎉 E2E seed completed successfully!');
console.log(`   Database: ${dbPath}`);
console.log(`   Test password for active users: ${TEST_PASSWORD}`);
console.log(`   Users: admin_e2e, editor_e2e, viewer_e2e, pending_e2e\n`);

await models.sequelize.close();
process.exit(0);
