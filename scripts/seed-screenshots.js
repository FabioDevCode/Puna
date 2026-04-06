/**
 * Seed script for screenshots / demo data.
 * Run with: node --env-file=.env scripts/seed-screenshots.js
 *
 * ⚠️  This script DELETES all existing sites, forms, inbox entries
 *     and site_user associations, then recreates realistic fake data
 *     spread over the last 30 days.
 *
 *     Users are NOT deleted — the currently logged-in admin is reused
 *     as the owner of all generated sites.
 */

import bcrypt from 'bcrypt';

// ── Dynamic imports (after env is loaded) ─────────────────────────
const { default: models } = await import('../src/models/index.js');
const { encryptString } = await import('../src/utils/crypto.js');
const { default: stringUtils } = await import('../src/utils/string.js');

// ── Helpers ───────────────────────────────────────────────────────

/** Random integer between min and max (inclusive) */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a random date within the last `days` days from now */
function randomDateInLastDays(days) {
    const now = Date.now();
    const msAgo = days * 24 * 60 * 60 * 1000;
    const ts = now - Math.floor(Math.random() * msAgo);
    return new Date(ts);
}

/**
 * Build a daily weight map for the last N days.
 * Creates a realistic, varied pattern:
 *  - light upward trend over the month
 *  - weekends are quieter (×0.3 – 0.5)
 *  - 2-3 random "peak" days (campaigns / mentions)
 *  - 1-2 random "dip" days (outages / holidays)
 *  - per-day noise so the curve is never flat
 */
function buildDailyWeights(days) {
    const weights = [];
    const now = new Date();

    // Pick 2-3 peak days and 1-2 dip days
    const peakDays = new Set();
    while (peakDays.size < randInt(2, 3)) peakDays.add(randInt(2, days - 2));
    const dipDays = new Set();
    while (dipDays.size < randInt(1, 2)) {
        const d = randInt(2, days - 2);
        if (!peakDays.has(d)) dipDays.add(d);
    }

    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (days - 1 - i));
        const dow = date.getDay(); // 0=Sun, 6=Sat

        // Base: gentle upward trend (0.5 → 1.0 over the month)
        let w = 0.5 + (i / (days - 1)) * 0.5;

        // Weekend factor
        if (dow === 0 || dow === 6) w *= 0.3 + Math.random() * 0.2;

        // Peak days: ×2.0 – 3.5
        if (peakDays.has(i)) w *= 2.0 + Math.random() * 1.5;

        // Dip days: ×0.1 – 0.25
        if (dipDays.has(i)) w *= 0.1 + Math.random() * 0.15;

        // Daily noise ±40 %
        w *= 0.6 + Math.random() * 0.8;

        weights.push(Math.max(w, 0.05)); // floor to avoid 0-weight days
    }
    return weights;
}

/** Pick a random day index according to weights, then a random time within that day */
function weightedRecentDate(days, _weights) {
    // Compute cumulative distribution
    const total = _weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    let dayIndex = 0;
    for (let i = 0; i < _weights.length; i++) {
        r -= _weights[i];
        if (r <= 0) {
            dayIndex = i;
            break;
        }
    }

    // dayIndex 0 = oldest day, days-1 = today
    const daysAgo = days - 1 - dayIndex;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    // Random hour weighted toward business hours (8-20h)
    const hour = Math.random() < 0.8 ? randInt(8, 20) : randInt(0, 23);
    date.setHours(hour, randInt(0, 59), randInt(0, 59), randInt(0, 999));
    return date;
}

// ── Data pools ────────────────────────────────────────────────────

const SITES = [
    { domain: 'portfolio.fabiolopes.dev', label: 'Portfolio' },
    { domain: 'blog.fabiolopes.fr', label: 'Blog' },
    { domain: 'startup-landing.io', label: 'Startup' },
    { domain: 'agence-web.fr', label: 'Agence' },
    { domain: 'e-commerce.shop', label: 'E-commerce' },
    { domain: 'saas-dashboard.app', label: 'SaaS' },
    { domain: 'restaurant-bordeaux.fr', label: 'Restaurant' },
    { domain: 'cabinet-avocat.paris', label: 'Cabinet' },
    { domain: 'association-sport.org', label: 'Association' },
    { domain: 'formation-dev.academy', label: 'Formation' },
];

const FORMS_PER_SITE = [
    {
        name: 'Contact',
        template: { nom: 'Nom', email: 'Email', message: 'Message' },
    },
    {
        name: 'Newsletter',
        template: { email: 'Email', preference: 'Préférence' },
    },
    {
        name: 'Devis',
        template: { nom: 'Nom', email: 'Email', societe: 'Société', budget: 'Budget', details: 'Détails' },
    },
    {
        name: 'Candidature',
        template: { nom: 'Nom', email: 'Email', poste: 'Poste', motivation: 'Motivation' },
    },
    {
        name: 'Support',
        template: { nom: 'Nom', email: 'Email', sujet: 'Sujet', description: 'Description' },
    },
    {
        name: 'Avis client',
        template: { nom: 'Nom', note: 'Note', commentaire: 'Commentaire' },
    },
    {
        name: 'Inscription événement',
        template: { nom: 'Nom', email: 'Email', participants: 'Participants', repas: 'Repas' },
    },
];

const FIRST_NAMES = [
    'Jean',
    'Marie',
    'Pierre',
    'Sophie',
    'Luc',
    'Camille',
    'Thomas',
    'Julie',
    'Nicolas',
    'Élodie',
    'Alexandre',
    'Laura',
    'Romain',
    'Chloé',
    'Maxime',
    'Emma',
    'Antoine',
    'Léa',
    'Hugo',
    'Manon',
    'Julien',
    'Clara',
    'Mathieu',
    'Sarah',
    'Florian',
    'Océane',
    'Quentin',
    'Inès',
    'Damien',
    'Zoé',
];

const LAST_NAMES = [
    'Dupont',
    'Martin',
    'Bernard',
    'Petit',
    'Robert',
    'Richard',
    'Durand',
    'Moreau',
    'Simon',
    'Laurent',
    'Michel',
    'Garcia',
    'Thomas',
    'Leroy',
    'Roux',
    'David',
    'Mercier',
    'Bertrand',
    'Morel',
    'Fournier',
    'Girard',
    'Bonnet',
    'Lambert',
    'Fontaine',
];

const COMPANIES = [
    'Acme Corp',
    'TechVision',
    'DigiFactory',
    'WebFlow Agency',
    'StartupLab',
    'CloudNest',
    'GreenData',
    'PixelPerfect',
    'NovaTech',
    'SynapseDigital',
    'CodeCraft',
    'DataPulse',
];

const SUBJECTS = [
    'Problème de connexion',
    'Bug affichage mobile',
    'Demande de fonctionnalité',
    'Question sur la facturation',
    'Erreur lors du paiement',
    'Mise à jour du compte',
    "Problème d'export",
    'Accès refusé',
    'Lenteur de chargement',
];

const MESSAGES = [
    "Bonjour, je souhaite obtenir plus d'informations sur vos services.",
    'Pourriez-vous me recontacter dès que possible ? Merci.',
    'Je suis intéressé par votre offre, comment procéder ?',
    "Merci pour votre réponse rapide, c'est très apprécié.",
    "J'ai un projet à vous soumettre, êtes-vous disponible cette semaine ?",
    'Suite à notre échange, je vous confirme mon intérêt.',
    "Pourriez-vous m'envoyer un devis détaillé ?",
    "J'aimerais planifier un appel pour discuter de notre collaboration.",
    'Votre site est très bien fait, bravo !',
    "Je rencontre un souci avec le formulaire, pouvez-vous m'aider ?",
    'Nous cherchons un partenaire technique pour notre lancement.',
    'Excellente expérience, je recommande vivement.',
];

const PREFERENCES = ['Tech', 'Design', 'Marketing', 'Business', 'Actualités'];
const BUDGETS = ['< 1 000 €', '1 000 – 5 000 €', '5 000 – 10 000 €', '10 000 – 50 000 €', '> 50 000 €'];
const POSTES = ['Développeur fullstack', 'Designer UI/UX', 'Chef de projet', 'DevOps', 'Product Manager'];
const NOTES = ['1', '2', '3', '4', '5'];
const PARTICIPANTS_COUNT = ['1', '2', '3', '4', '5', '6', '8', '10'];
const REPAS_OPTIONS = ['Végétarien', 'Standard', 'Sans gluten', 'Halal', 'Aucun'];

/**
 * Generate a realistic inbox content object based on form template keys.
 */
function generateInboxContent(templateKeys) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(['gmail.com', 'outlook.fr', 'yahoo.fr', 'proton.me', 'free.fr'])}`;

    const content = {};
    for (const key of templateKeys) {
        switch (key) {
            case 'nom':
                content[key] = `${firstName} ${lastName}`;
                break;
            case 'email':
                content[key] = email;
                break;
            case 'message':
            case 'motivation':
            case 'description':
                content[key] = pick(MESSAGES);
                break;
            case 'societe':
                content[key] = pick(COMPANIES);
                break;
            case 'budget':
                content[key] = pick(BUDGETS);
                break;
            case 'poste':
                content[key] = pick(POSTES);
                break;
            case 'preference':
                content[key] = pick(PREFERENCES);
                break;
            case 'sujet':
                content[key] = pick(SUBJECTS);
                break;
            case 'note':
                content[key] = pick(NOTES);
                break;
            case 'commentaire':
                content[key] = pick(MESSAGES);
                break;
            case 'participants':
                content[key] = pick(PARTICIPANTS_COUNT);
                break;
            case 'repas':
                content[key] = pick(REPAS_OPTIONS);
                break;
            default:
                content[key] = `Valeur test pour ${key}`;
        }
    }
    return content;
}

// ── Main ──────────────────────────────────────────────────────────

console.log('\n🎬 Seed Screenshots — Génération de données de démo\n');

// 1. Find or create the admin user
let adminUser = await models.User.findOne({
    where: { role: 'super_admin', status: 'active' },
});

if (!adminUser) {
    console.log("⚠️  Aucun super_admin actif trouvé — création d'un compte admin de démo");
    const hashedPassword = await bcrypt.hash('DemoPassword1!Scr@@n', 10);
    adminUser = await models.User.create({
        login: 'admin_demo',
        email: 'admin@demo.puna.dev',
        password: hashedPassword,
        role: 'super_admin',
        status: 'active',
        locale: 'fr',
    });
    console.log('   → Créé : admin_demo / DemoPassword1!Scr@@n');
}
console.log(`👤 Admin utilisé : ${adminUser.login} (${adminUser.id})\n`);

// 2. Delete existing demo data (preserve users)
console.log('🗑️  Nettoyage des données existantes...');

// Disable FK checks to allow truncation in correct order
await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

const existingInboxCount = await models.Inbox.destroy({ where: {}, truncate: true });
console.log(`   Inbox supprimées : ${existingInboxCount || 'toutes'}`);

const existingFormCount = await models.Form.destroy({ where: {}, truncate: true });
console.log(`   Formulaires supprimés : ${existingFormCount || 'tous'}`);

const existingSiteUserCount = await models.SiteUser.destroy({ where: {}, truncate: true });
console.log(`   Associations SiteUser supprimées : ${existingSiteUserCount || 'toutes'}`);

const existingSiteCount = await models.Site.destroy({ where: {}, truncate: true });
console.log(`   Sites supprimés : ${existingSiteCount || 'tous'}`);

// Re-enable FK checks
await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

console.log('');

// 3. Create sites
console.log('🌐 Création des sites...');
const createdSites = [];

for (const siteData of SITES) {
    const site = await models.Site.create({
        domain: siteData.domain,
        control_code: encryptString(`control-${siteData.domain}-${Date.now()}`),
        fk_id_user: adminUser.id,
        createdAt: randomDateInLastDays(45), // Sites created 15-45 days ago
    });

    // Associate admin to site
    await models.SiteUser.create({
        fk_id_site: site.id,
        fk_id_user: adminUser.id,
    });

    createdSites.push({ ...site.toJSON(), label: siteData.label });
    console.log(`   ✓ ${siteData.domain}`);
}
console.log('');

// 4. Create forms (2-4 forms per site, picked from pool)
console.log('📋 Création des formulaires...');
const createdForms = [];

for (const site of createdSites) {
    const formCount = randInt(3, 5);
    // Shuffle and pick forms for this site
    const shuffled = [...FORMS_PER_SITE].sort(() => Math.random() - 0.5);
    const formsForSite = shuffled.slice(0, formCount);

    for (const formData of formsForSite) {
        const templateKeys = Object.keys(formData.template);
        const columns = {};
        templateKeys.forEach((k) => (columns[k] = true));

        const form = await models.Form.create({
            name: formData.name,
            code: stringUtils.generateCode(16),
            fk_id_site: site.id,
            template: JSON.stringify(formData.template),
            columns: JSON.stringify(columns),
            createdAt: new Date(new Date(site.createdAt).getTime() + randInt(0, 3) * 24 * 60 * 60 * 1000),
        });

        createdForms.push({
            id: form.id,
            name: formData.name,
            siteLabel: site.label,
            siteDomain: site.domain,
            templateKeys,
        });
    }
    console.log(`   ✓ ${site.label} (${site.domain}) — ${formCount} formulaires`);
}
console.log('');

// 5. Create inbox entries spread over 30 days
console.log('📥 Génération des soumissions (30 derniers jours)...');

const DAYS = 30;
let totalInbox = 0;

for (const form of createdForms) {
    // Each form gets its own weight curve (different peak/dip patterns)
    const weights = buildDailyWeights(DAYS);

    // Variable number of submissions per form (some forms are more active)
    const isPopular = Math.random() < 0.3; // 30% of forms get a lot of traffic
    const count = isPopular ? randInt(50, 120) : randInt(10, 40);

    const inboxBulk = [];
    for (let i = 0; i < count; i++) {
        const content = generateInboxContent(form.templateKeys);
        inboxBulk.push({
            fk_id_form: form.id,
            content: JSON.stringify(content),
            createdAt: weightedRecentDate(DAYS, weights),
            updatedAt: new Date(),
        });
    }

    await models.Inbox.bulkCreate(inboxBulk);
    totalInbox += count;
    console.log(`   ✓ ${form.siteLabel} / ${form.name} — ${count} soumissions${isPopular ? ' ⭐' : ''}`);
}

console.log('');

// ── Summary ───────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════');
console.log('  🎬 Seed terminé avec succès !');
console.log('═══════════════════════════════════════════════');
console.log(`  Sites       : ${createdSites.length}`);
console.log(`  Formulaires : ${createdForms.length}`);
console.log(`  Soumissions : ${totalInbox}`);
console.log(`  Période     : 30 derniers jours`);
console.log(`  Admin       : ${adminUser.login}`);
console.log('═══════════════════════════════════════════════\n');

await models.sequelize.close();
process.exit(0);
