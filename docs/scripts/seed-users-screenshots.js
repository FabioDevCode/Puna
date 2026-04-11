/**
 * Seed script for users screenshots / demo data.
 * Run with: node --env-file=.env scripts/seed-users-screenshots.js
 *
 * ⚠️  This script DELETES all existing users EXCEPT the one with login "admin",
 *     then recreates a varied set of users covering all roles, statuses and edge
 *     cases (no email, last connection, TOTP, etc.) for UI screenshot purposes.
 */

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

// ── Dynamic imports (after env is loaded) ─────────────────────────
const { default: models } = await import('../../src/models/index.js');

// ── Helpers ───────────────────────────────────────────────────────

/** Random integer between min and max (inclusive) */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a random date within the last `days` days */
function randomDateInLastDays(days) {
    const now = Date.now();
    const ts = now - Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
    return new Date(ts);
}

// ── User pool ─────────────────────────────────────────────────────

const HASHED_PASSWORD = await bcrypt.hash('DemoPassword1!Scr@@n', 10);

/**
 * Each entry defines one user to create.
 * Fields left undefined fall back to model defaults.
 */
const USERS = [
    // ── Owners ──────────────────────────────────────────────────
    {
        login: 'owner_alice',
        email: 'alice.martin@agency.fr',
        role: 'owner',
        status: 'active',
        last_connection: randomDateInLastDays(3),
        createdAt: randomDateInLastDays(120),
    },
    {
        login: 'owner_bob',
        email: 'bob.dupont@startup.io',
        role: 'owner',
        status: 'active',
        last_connection: randomDateInLastDays(15),
        createdAt: randomDateInLastDays(200),
    },

    // ── Editors ─────────────────────────────────────────────────
    {
        login: 'editor_sophie',
        email: 'sophie.roux@agency.fr',
        role: 'editor',
        status: 'pending',
        last_connection: null,
        createdAt: randomDateInLastDays(60),
    },
    {
        login: 'editor_thomas',
        email: 'thomas.girard@startup.io',
        role: 'editor',
        status: 'active',
        last_connection: randomDateInLastDays(7),
        createdAt: randomDateInLastDays(90),
    },
    {
        login: 'editor_camille',
        email: 'camille.leroy@freelance.fr',
        role: 'editor',
        status: 'inactive',
        last_connection: randomDateInLastDays(60),
        createdAt: randomDateInLastDays(150),
    },

    // ── Viewers ─────────────────────────────────────────────────
    {
        login: 'viewer_lucas',
        email: 'lucas.moreau@client.com',
        role: 'viewer',
        status: 'pending',
        last_connection: null,
        createdAt: randomDateInLastDays(30),
    },
    {
        login: 'viewer_chloe',
        email: 'chloe.petit@client.com',
        role: 'viewer',
        status: 'inactive',
        last_connection: randomDateInLastDays(90),
        createdAt: randomDateInLastDays(180),
    },

    // ── Beta ────────────────────────────────────────────────────
    {
        login: 'beta_maxime',
        email: 'maxime.simon@beta.puna.dev',
        role: 'beta',
        status: 'active',
        last_connection: randomDateInLastDays(1),
        createdAt: randomDateInLastDays(20),
    },
    // {
    //     login: 'beta_inès',
    //     email: 'ines.david@beta.puna.dev',
    //     role: 'beta',
    //     status: 'active',
    //     last_connection: randomDateInLastDays(4),
    //     createdAt: randomDateInLastDays(25),
    // },

    // ── Suspended / Banned ──────────────────────────────────────
    {
        login: 'user_suspended',
        email: 'suspended.user@example.com',
        role: 'viewer',
        status: 'suspended',
        last_connection: randomDateInLastDays(45),
        createdAt: randomDateInLastDays(200),
    },
    {
        login: 'user_banned',
        email: 'banned.user@example.com',
        role: 'editor',
        status: 'banned',
        last_connection: randomDateInLastDays(100),
        createdAt: randomDateInLastDays(300),
    },

    // ── Anonymized ──────────────────────────────────────────────
    {
        login: 'anonymized_00001',
        email: null,
        role: 'viewer',
        status: 'anonymized',
        last_connection: null,
        createdAt: randomDateInLastDays(365),
    },

    // ── Never connected ─────────────────────────────────────────
];

// ── Main ──────────────────────────────────────────────────────────

console.log('\n👤 Seed Users Screenshots — Génération de données de démo\n');

// 1. Find the admin user to keep
const adminUser = await models.User.findOne({ where: { login: 'admin' } });

if (!adminUser) {
    console.error('❌ Aucun utilisateur avec le login "admin" trouvé. Abandon.');
    await models.sequelize.close();
    process.exit(1);
}

console.log(`🔒 Utilisateur protégé : "${adminUser.login}" (${adminUser.id})\n`);

// 2. Delete all users except admin
console.log('🗑️  Suppression des autres utilisateurs...');

const deleted = await models.User.destroy({
    where: {
        login: { [Op.ne]: 'admin' },
    },
});

console.log(`   → ${deleted} utilisateur(s) supprimé(s)\n`);

// 3. Create demo users
console.log('🧑‍💻 Création des utilisateurs de démo...\n');

let created = 0;

for (const userData of USERS) {
    await models.User.create({
        login: userData.login,
        email: userData.email ?? null,
        password: HASHED_PASSWORD,
        role: userData.role,
        status: userData.status,
        last_connection: userData.last_connection ?? null,
        created_by: adminUser.id,
        createdAt: userData.createdAt,
        updatedAt: userData.createdAt,
    });

    const emailDisplay = userData.email ?? '(aucun email)';
    const lastCo = userData.last_connection ? userData.last_connection.toLocaleDateString('fr-FR') : 'jamais';
    console.log(`   ✓ [${userData.role.padEnd(11)}] [${userData.status.padEnd(10)}] ${userData.login.padEnd(22)} ${emailDisplay} — dernière co : ${lastCo}`);
    created++;
}

// ── Summary ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
console.log('  👤 Seed utilisateurs terminé !');
console.log('═══════════════════════════════════════════════');
console.log(`  Supprimés   : ${deleted}`);
console.log(`  Créés       : ${created}`);
console.log(`  Protégé     : "${adminUser.login}"`);
console.log('═══════════════════════════════════════════════\n');

await models.sequelize.close();
process.exit(0);
