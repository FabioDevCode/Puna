# Guide d'intégration Email avec Nodemailer

## 📋 Résumé

Ce document décrit l'architecture recommandée pour intégrer l'envoi d'emails dans Puna en utilisant **Nodemailer** avec des **templates Handlebars**.

---

## 🎯 Objectifs

1. Envoyer des emails transactionnels (première connexion, mot de passe oublié, bienvenue beta)
2. Templates HTML éditables avec variables dynamiques
3. Visualisation des templates depuis le panel d'administration
4. Architecture extensible pour des usages futurs

---

## 1️⃣ Configuration SMTP : Où la stocker ?

### Recommandation : **Hybride (Variables d'environnement + BDD)**

| Élément | Stockage | Raison |
|---------|----------|--------|
| **Host SMTP** | `.env` | Rarement modifié, sensible |
| **Port SMTP** | `.env` | Rarement modifié |
| **User SMTP** | `.env` | Credentials sensibles |
| **Password SMTP** | `.env` | Credentials sensibles |
| **Expéditeur par défaut** | BDD | Peut être modifié via admin |
| **Templates emails** | BDD | Éditables depuis l'admin |

### Variables d'environnement à ajouter

```bash
# .env
# ══════════════════════════════════════════════════════════════════
# Configuration SMTP
# ══════════════════════════════════════════════════════════════════
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false          # true pour 465, false pour autres ports
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM_NAME=Puna        # Nom expéditeur par défaut
SMTP_FROM_EMAIL=noreply@puna.io
```

### Mise à jour de `env.validator.js`

Ajouter les variables SMTP dans la section `OPTIONAL_VARS` (optionnelles car l'envoi d'email n'est pas critique au démarrage) ou `REQUIRED_VARS` si tu veux forcer la configuration.

```javascript
// Dans OPTIONAL_VARS
const OPTIONAL_VARS = {
    // ... existants
    SMTP_HOST: '',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM_NAME: 'Puna',
    SMTP_FROM_EMAIL: 'noreply@puna.io',
};
```

---

## 2️⃣ Structure des fichiers proposée

```
src/
├── config/
│   └── mailer.js              # Configuration Nodemailer
├── services/
│   └── email.service.js       # Service d'envoi d'emails
├── models/
│   ├── emailTemplate.models.js   # Modèle pour les templates
│   └── attributes/
│       └── emailTemplate.attributes.json
├── views/
│   └── emails/                # Templates par défaut (fichiers)
│       ├── layouts/
│       │   └── default.hbs    # Layout commun emails
│       ├── welcome.hbs
│       ├── reset-password.hbs
│       └── first-login.hbs
└── controllers/
    └── emailTemplate.controller.js  # Gestion admin des templates
```

---

## 3️⃣ Configuration Nodemailer

### Fichier : `src/config/mailer.js`

```javascript
import nodemailer from 'nodemailer';

// Configuration du transporteur SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true pour 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    // Options supplémentaires recommandées
    pool: true,           // Réutilise les connexions
    maxConnections: 5,    // Max connexions simultanées
    maxMessages: 100,     // Max messages par connexion
});

// Vérification de la connexion au démarrage
export async function verifyMailer() {
    if (!process.env.SMTP_HOST) {
        console.warn('⚠️  SMTP not configured - Email sending disabled');
        return false;
    }

    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified');
        return true;
    } catch (error) {
        console.error('❌ SMTP connection failed:', error.message);
        return false;
    }
}

export default transporter;
```

---

## 4️⃣ Modèle EmailTemplate (BDD)

### Fichier : `src/models/attributes/emailTemplate.attributes.json`

```json
{
    "id": {
        "type": "INTEGER",
        "autoIncrement": true,
        "primaryKey": true
    },
    "slug": {
        "type": "STRING",
        "allowNull": false,
        "unique": true,
        "comment": "Identifiant unique du template (ex: welcome, reset-password)"
    },
    "name": {
        "type": "STRING",
        "allowNull": false,
        "comment": "Nom affichable du template"
    },
    "subject": {
        "type": "STRING",
        "allowNull": false,
        "comment": "Sujet de l'email (peut contenir des variables Handlebars)"
    },
    "htmlContent": {
        "type": "TEXT",
        "allowNull": false,
        "comment": "Contenu HTML du template avec variables Handlebars"
    },
    "textContent": {
        "type": "TEXT",
        "allowNull": true,
        "comment": "Version texte brut (fallback)"
    },
    "variables": {
        "type": "JSON",
        "allowNull": true,
        "comment": "Liste des variables disponibles avec description",
        "defaultValue": []
    },
    "isActive": {
        "type": "BOOLEAN",
        "defaultValue": true
    },
    "category": {
        "type": "STRING",
        "defaultValue": "transactional",
        "comment": "Catégorie: transactional, marketing, notification"
    }
}
```

### Fichier : `src/models/emailTemplate.models.js`

```javascript
import { DataTypes } from 'sequelize';
import attributes from './attributes/emailTemplate.attributes.json' assert { type: 'json' };

export default (sequelize) => {
    const EmailTemplate = sequelize.define('EmailTemplate', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        htmlContent: {
            type: DataTypes.TEXT('long'),
            allowNull: false,
        },
        textContent: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        variables: {
            type: DataTypes.JSON,
            defaultValue: [],
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        category: {
            type: DataTypes.STRING,
            defaultValue: 'transactional',
        },
    }, {
        tableName: 'email_templates',
        timestamps: true,
    });

    return EmailTemplate;
};
```

---

## 5️⃣ Service Email

### Fichier : `src/services/email.service.js`

```javascript
import Handlebars from 'handlebars';
import transporter from '../config/mailer.js';
import models from '../models/index.js';

// Cache pour les templates compilés
const templateCache = new Map();

/**
 * Récupère et compile un template depuis la BDD
 * @param {string} slug - Identifiant du template
 * @returns {Object} Template compilé avec subject et html
 */
async function getCompiledTemplate(slug) {
    // Vérifier le cache
    if (templateCache.has(slug)) {
        return templateCache.get(slug);
    }

    const template = await models.EmailTemplate.findOne({
        where: { slug, isActive: true },
    });

    if (!template) {
        throw new Error(`Email template "${slug}" not found or inactive`);
    }

    const compiled = {
        subject: Handlebars.compile(template.subject),
        html: Handlebars.compile(template.htmlContent),
        text: template.textContent ? Handlebars.compile(template.textContent) : null,
    };

    // Mettre en cache (en production)
    if (process.env.NODE_ENV === 'production') {
        templateCache.set(slug, compiled);
    }

    return compiled;
}

/**
 * Invalider le cache d'un template (après modification)
 * @param {string} slug - Identifiant du template
 */
export function invalidateTemplateCache(slug) {
    templateCache.delete(slug);
}

/**
 * Envoyer un email à partir d'un template
 * @param {Object} options - Options d'envoi
 * @param {string} options.to - Email destinataire
 * @param {string} options.templateSlug - Slug du template à utiliser
 * @param {Object} options.variables - Variables à injecter dans le template
 * @param {string} [options.from] - Email expéditeur (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendTemplatedEmail({ to, templateSlug, variables = {}, from }) {
    const template = await getCompiledTemplate(templateSlug);

    // Variables communes à tous les emails
    const commonVariables = {
        appName: 'Puna',
        currentYear: new Date().getFullYear(),
        supportEmail: process.env.SMTP_FROM_EMAIL,
        ...variables,
    };

    const mailOptions = {
        from: from || `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to,
        subject: template.subject(commonVariables),
        html: template.html(commonVariables),
    };

    // Ajouter la version texte si disponible
    if (template.text) {
        mailOptions.text = template.text(commonVariables);
    }

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${to} [${templateSlug}]`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error.message);
        throw error;
    }
}

/**
 * Envoyer un email brut (sans template BDD)
 * @param {Object} options - Options nodemailer standard
 */
export async function sendRawEmail(options) {
    const mailOptions = {
        from: options.from || `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        ...options,
    };

    return await transporter.sendMail(mailOptions);
}

// ══════════════════════════════════════════════════════════════════
// Fonctions utilitaires pour les emails courants
// ══════════════════════════════════════════════════════════════════

/**
 * Email de bienvenue
 */
export async function sendWelcomeEmail(user) {
    return sendTemplatedEmail({
        to: user.email,
        templateSlug: 'welcome',
        variables: {
            userName: user.name,
            userEmail: user.email,
        },
    });
}

/**
 * Email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(user, resetToken, resetUrl) {
    return sendTemplatedEmail({
        to: user.email,
        templateSlug: 'reset-password',
        variables: {
            userName: user.name,
            resetUrl,
            resetToken,
            expiresIn: '1 heure',
        },
    });
}

/**
 * Email de première connexion
 */
export async function sendFirstLoginEmail(user, loginUrl) {
    return sendTemplatedEmail({
        to: user.email,
        templateSlug: 'first-login',
        variables: {
            userName: user.name,
            userEmail: user.email,
            loginUrl,
        },
    });
}

/**
 * Email d'invitation beta
 */
export async function sendBetaInviteEmail(user, inviteUrl) {
    return sendTemplatedEmail({
        to: user.email,
        templateSlug: 'beta-invite',
        variables: {
            userName: user.name,
            inviteUrl,
        },
    });
}
```

---

## 6️⃣ Templates HTML par défaut

### Structure des variables dans les templates

Les templates utilisent la syntaxe Handlebars standard :

| Syntaxe | Description |
|---------|-------------|
| `{{variable}}` | Affiche la variable (échappée HTML) |
| `{{{variable}}}` | Affiche la variable (non échappée - HTML brut) |
| `{{#if condition}}...{{/if}}` | Condition |
| `{{#each items}}...{{/each}}` | Boucle |

### Template de base : Layout commun

```html
<!-- src/views/emails/layouts/default.hbs -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #007bff;
        }
        .content {
            padding: 30px 0;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{appName}}</h1>
    </div>
    <div class="content">
        {{{content}}}
    </div>
    <div class="footer">
        <p>© {{currentYear}} {{appName}} - Tous droits réservés</p>
        <p>Cet email a été envoyé à {{recipientEmail}}</p>
    </div>
</body>
</html>
```

### Exemple : Template "Welcome"

**Stocké en BDD avec les métadonnées :**

```javascript
{
    slug: 'welcome',
    name: 'Email de bienvenue',
    subject: 'Bienvenue sur {{appName}}, {{userName}} ! 🎉',
    variables: [
        { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
        { name: 'userEmail', description: 'Email de l\'utilisateur', required: true },
        { name: 'loginUrl', description: 'URL de connexion', required: false }
    ],
    htmlContent: `
        <h2>Bonjour {{userName}},</h2>

        <p>Bienvenue sur <strong>{{appName}}</strong> ! Nous sommes ravis de vous compter parmi nous.</p>

        <p>Votre compte a été créé avec succès avec l'adresse email : <strong>{{userEmail}}</strong></p>

        {{#if loginUrl}}
        <p>
            <a href="{{loginUrl}}" class="button">Se connecter</a>
        </p>
        {{/if}}

        <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>

        <p>À bientôt,<br>L'équipe {{appName}}</p>
    `,
    category: 'transactional'
}
```

### Exemple : Template "Reset Password"

```javascript
{
    slug: 'reset-password',
    name: 'Réinitialisation de mot de passe',
    subject: 'Réinitialisation de votre mot de passe {{appName}}',
    variables: [
        { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
        { name: 'resetUrl', description: 'URL de réinitialisation', required: true },
        { name: 'expiresIn', description: 'Durée de validité', required: true }
    ],
    htmlContent: `
        <h2>Bonjour {{userName}},</h2>

        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>

        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>

        <p>
            <a href="{{resetUrl}}" class="button">Réinitialiser mon mot de passe</a>
        </p>

        <p><strong>Ce lien expirera dans {{expiresIn}}.</strong></p>

        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.</p>

        <p>L'équipe {{appName}}</p>
    `,
    category: 'transactional'
}
```

---

## 7️⃣ Éditeur de templates avec CodeMirror 5

### Pourquoi CodeMirror 5 ?

- ✅ **Standalone** : Pas de bundler requis, fonctionne en vanilla JS
- ✅ **Syntaxe HTML + CSS** : Supporte les balises `<style>` et le CSS inline
- ✅ **Léger** : ~400KB total avec les modes nécessaires
- ✅ **Cohérent** : S'intègre comme les autres plugins (ApexCharts, Toastify...)

### Installation du plugin

**Télécharger depuis** : https://codemirror.net/5/codemirror.zip

**Structure à créer** :

```
src/public/plugins/
└── codemirror/
    ├── lib/
    │   ├── codemirror.js
    │   └── codemirror.css
    ├── mode/
    │   ├── xml/
    │   │   └── xml.js           # Base pour HTML
    │   ├── css/
    │   │   └── css.js           # Support CSS
    │   ├── javascript/
    │   │   └── javascript.js    # Support JS (optionnel)
    │   └── htmlmixed/
    │       └── htmlmixed.js     # HTML + CSS + JS combiné
    ├── addon/
    │   ├── edit/
    │   │   ├── closetag.js      # Fermeture auto des balises
    │   │   └── closebrackets.js # Fermeture auto des brackets
    │   ├── fold/
    │   │   ├── foldcode.js      # Repliage de code
    │   │   ├── foldgutter.js
    │   │   ├── brace-fold.js
    │   │   └── xml-fold.js
    │   └── hint/
    │       ├── show-hint.js     # Autocomplétion
    │       ├── show-hint.css
    │       ├── html-hint.js
    │       └── css-hint.js
    └── theme/
        └── dracula.css          # Thème sombre (optionnel)
```

### Intégration dans la vue admin

**Fichier : `src/views/pages/admin/email-template-edit.hbs`**

```html
<!-- CSS CodeMirror -->
<link rel="stylesheet" href="/plugins/codemirror/lib/codemirror.css">
<link rel="stylesheet" href="/plugins/codemirror/addon/hint/show-hint.css">
<link rel="stylesheet" href="/plugins/codemirror/addon/fold/foldgutter.css">
<!-- Thème optionnel -->
<link rel="stylesheet" href="/plugins/codemirror/theme/dracula.css">

<!-- Formulaire d'édition -->
<form id="templateForm" method="POST">
    <div class="form-group">
        <label for="subject">Sujet de l'email</label>
        <input type="text" id="subject" name="subject" value="{{template.subject}}" class="input input-bordered w-full">
    </div>

    <div class="form-group">
        <label for="htmlContent">Contenu HTML</label>
        <textarea id="htmlContent" name="htmlContent">{{template.htmlContent}}</textarea>
    </div>

    <!-- Variables disponibles -->
    <div class="variables-help">
        <h4>Variables disponibles :</h4>
        <ul>
            {{#each template.variables}}
            <li><code>\{{{{this.name}}}}</code> - {{this.description}}</li>
            {{/each}}
        </ul>
    </div>

    <div class="form-actions">
        <button type="submit" class="btn btn-primary">Enregistrer</button>
        <button type="button" id="previewBtn" class="btn btn-secondary">Prévisualiser</button>
    </div>
</form>

<!-- Iframe pour prévisualisation -->
<div id="previewContainer" class="hidden">
    <h4>Aperçu</h4>
    <iframe id="previewFrame" class="w-full h-96 border rounded"></iframe>
</div>

<!-- Scripts CodeMirror -->
<script src="/plugins/codemirror/lib/codemirror.js"></script>
<!-- Modes -->
<script src="/plugins/codemirror/mode/xml/xml.js"></script>
<script src="/plugins/codemirror/mode/css/css.js"></script>
<script src="/plugins/codemirror/mode/javascript/javascript.js"></script>
<script src="/plugins/codemirror/mode/htmlmixed/htmlmixed.js"></script>
<!-- Addons -->
<script src="/plugins/codemirror/addon/edit/closetag.js"></script>
<script src="/plugins/codemirror/addon/edit/closebrackets.js"></script>
<script src="/plugins/codemirror/addon/fold/foldcode.js"></script>
<script src="/plugins/codemirror/addon/fold/foldgutter.js"></script>
<script src="/plugins/codemirror/addon/fold/xml-fold.js"></script>
<script src="/plugins/codemirror/addon/fold/brace-fold.js"></script>
<script src="/plugins/codemirror/addon/hint/show-hint.js"></script>
<script src="/plugins/codemirror/addon/hint/html-hint.js"></script>
<script src="/plugins/codemirror/addon/hint/css-hint.js"></script>
```

### Script d'initialisation

**Fichier : `src/public/js/admin_email_editor.js`**

```javascript
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('htmlContent');

    // Initialisation de CodeMirror
    const editor = CodeMirror.fromTextArea(textarea, {
        mode: 'htmlmixed',           // HTML + CSS + JS
        theme: 'default',            // ou 'dracula' pour thème sombre
        lineNumbers: true,           // Numéros de ligne
        lineWrapping: true,          // Retour à la ligne automatique
        indentUnit: 4,               // Indentation
        tabSize: 4,
        autoCloseTags: true,         // Fermeture auto des balises HTML
        autoCloseBrackets: true,     // Fermeture auto des brackets
        matchBrackets: true,         // Highlight des brackets correspondants
        foldGutter: true,            // Repliage de code
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        extraKeys: {
            'Ctrl-Space': 'autocomplete',  // Autocomplétion
            'Ctrl-Q': function(cm) {       // Toggle fold
                cm.foldCode(cm.getCursor());
            }
        }
    });

    // Hauteur de l'éditeur
    editor.setSize(null, 500);

    // Synchroniser avec le textarea avant soumission
    document.getElementById('templateForm').addEventListener('submit', function() {
        editor.save();
    });

    // Prévisualisation
    document.getElementById('previewBtn').addEventListener('click', function() {
        const content = editor.getValue();
        const previewContainer = document.getElementById('previewContainer');
        const previewFrame = document.getElementById('previewFrame');

        // Remplacer les variables Handlebars par des exemples
        const previewContent = content
            .replace(/\{\{userName\}\}/g, 'Jean Dupont')
            .replace(/\{\{userEmail\}\}/g, 'jean@example.com')
            .replace(/\{\{appName\}\}/g, 'Puna')
            .replace(/\{\{currentYear\}\}/g, new Date().getFullYear())
            .replace(/\{\{resetUrl\}\}/g, 'https://example.com/reset')
            .replace(/\{\{loginUrl\}\}/g, 'https://example.com/login')
            .replace(/\{\{inviteUrl\}\}/g, 'https://example.com/invite')
            .replace(/\{\{expiresIn\}\}/g, '1 heure');

        // Injecter dans l'iframe
        previewFrame.srcdoc = previewContent;
        previewContainer.classList.remove('hidden');
    });
});
```

### Styles CSS pour l'éditeur

**À ajouter dans votre CSS admin :**

```css
/* Container de l'éditeur */
.CodeMirror {
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* Thème clair personnalisé */
.CodeMirror-focused {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* Highlight des balises Handlebars */
.cm-mustache {
    color: #e83e8c;
    font-weight: bold;
}

/* Zone de variables */
.variables-help {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
}

.variables-help code {
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 3px;
    color: #e83e8c;
}

/* Prévisualisation */
#previewContainer {
    margin-top: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
}

#previewFrame {
    background: white;
}
```

---

## 8️⃣ Interface Admin pour les templates

### Fonctionnalités recommandées

1. **Liste des templates** : Vue tableau avec slug, nom, catégorie, statut
2. **Édition du template** : Éditeur CodeMirror avec coloration HTML/CSS
3. **Variables disponibles** : Affichage des variables et leur description
4. **Prévisualisation** : Rendu du template avec données de test dans une iframe
5. **Envoi de test** : Envoyer un email de test à une adresse

### Routes suggérées

```javascript
// Routes admin pour les templates email
router.get('/admin/emails', emailTemplateController.list);
router.get('/admin/emails/:slug', emailTemplateController.edit);
router.post('/admin/emails/:slug', emailTemplateController.update);
router.post('/admin/emails/:slug/preview', emailTemplateController.preview);
router.post('/admin/emails/:slug/test', emailTemplateController.sendTest);
```

---

## 8️⃣ Seed des templates par défaut

### Fichier : `src/helpers/init_email_templates.js`

```javascript
import models from '../models/index.js';

const defaultTemplates = [
    {
        slug: 'welcome',
        name: 'Email de bienvenue',
        subject: 'Bienvenue sur {{appName}}, {{userName}} ! 🎉',
        htmlContent: `<h2>Bonjour {{userName}},</h2>
            <p>Bienvenue sur <strong>{{appName}}</strong> !</p>
            <p>Votre compte : <strong>{{userEmail}}</strong></p>`,
        variables: [
            { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
            { name: 'userEmail', description: 'Email de l\'utilisateur', required: true },
        ],
        category: 'transactional',
    },
    {
        slug: 'reset-password',
        name: 'Réinitialisation de mot de passe',
        subject: 'Réinitialisation de votre mot de passe',
        htmlContent: `<h2>Bonjour {{userName}},</h2>
            <p>Cliquez pour réinitialiser : <a href="{{resetUrl}}">Réinitialiser</a></p>
            <p>Expire dans {{expiresIn}}.</p>`,
        variables: [
            { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
            { name: 'resetUrl', description: 'URL de réinitialisation', required: true },
            { name: 'expiresIn', description: 'Durée de validité', required: true },
        ],
        category: 'transactional',
    },
    {
        slug: 'first-login',
        name: 'Première connexion',
        subject: 'Votre accès à {{appName}}',
        htmlContent: `<h2>Bonjour {{userName}},</h2>
            <p>Votre compte a été créé. Connectez-vous : <a href="{{loginUrl}}">{{loginUrl}}</a></p>`,
        variables: [
            { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
            { name: 'loginUrl', description: 'URL de connexion', required: true },
        ],
        category: 'transactional',
    },
    {
        slug: 'beta-invite',
        name: 'Invitation Beta',
        subject: 'Vous êtes invité à rejoindre la beta {{appName}} ! 🚀',
        htmlContent: `<h2>Bonjour {{userName}},</h2>
            <p>Vous avez été sélectionné pour la beta !</p>
            <p><a href="{{inviteUrl}}">Rejoindre la beta</a></p>`,
        variables: [
            { name: 'userName', description: 'Nom de l\'utilisateur', required: true },
            { name: 'inviteUrl', description: 'URL d\'invitation', required: true },
        ],
        category: 'marketing',
    },
];

export async function initEmailTemplates() {
    for (const template of defaultTemplates) {
        const [record, created] = await models.EmailTemplate.findOrCreate({
            where: { slug: template.slug },
            defaults: template,
        });

        if (created) {
            console.log(`📧 Email template "${template.slug}" created`);
        }
    }
}
```

---

## 1️⃣0️⃣ Dépendances et assets

### NPM (côté serveur)

```bash
npm install nodemailer
```

### Plugin CodeMirror 5 (côté client)

1. **Télécharger** : https://codemirror.net/5/codemirror.zip
2. **Extraire** dans `src/public/plugins/codemirror/`
3. **Fichiers requis** :

| Fichier | Obligatoire | Description |
|---------|-------------|-------------|
| `lib/codemirror.js` | ✅ | Core |
| `lib/codemirror.css` | ✅ | Styles de base |
| `mode/xml/xml.js` | ✅ | Base pour HTML |
| `mode/css/css.js` | ✅ | Support `<style>` et CSS inline |
| `mode/htmlmixed/htmlmixed.js` | ✅ | Combine HTML + CSS |
| `mode/javascript/javascript.js` | ⚠️ | Si scripts inline |
| `addon/edit/closetag.js` | 💡 | Fermeture auto balises |
| `addon/edit/closebrackets.js` | 💡 | Fermeture auto `{}[]` |
| `addon/fold/*.js` | 💡 | Repliage de code |
| `theme/dracula.css` | 💡 | Thème sombre |

---

## 1️⃣1️⃣ Checklist d'implémentation

### Backend
- [ ] Installer nodemailer (`npm install nodemailer`)
- [ ] Ajouter variables SMTP dans `.env` et `.env.example`
- [ ] Mettre à jour `env.validator.js` avec les variables SMTP
- [ ] Créer `src/config/mailer.js`
- [ ] Créer le modèle `EmailTemplate`
- [ ] Créer `src/services/email.service.js`
- [ ] Créer le seed des templates par défaut
- [ ] Créer le controller et les routes admin
- [ ] Ajouter les permissions pour l'édition des templates

### Frontend (Admin)
- [ ] Télécharger et installer CodeMirror 5 dans `src/public/plugins/codemirror/`
- [ ] Créer `src/public/js/admin_email_editor.js`
- [ ] Créer les vues admin (liste, édition, prévisualisation)
- [ ] Ajouter styles CSS pour l'éditeur

### Tests
- [ ] Tester l'envoi d'emails
- [ ] Tester la prévisualisation des templates

---

## 📚 Ressources

- [Documentation Nodemailer](https://nodemailer.com/)
- [Handlebars.js Guide](https://handlebarsjs.com/guide/)
- [CodeMirror 5 Documentation](https://codemirror.net/5/doc/manual.html)
- [CodeMirror 5 - Mode HTMLMixed](https://codemirror.net/5/mode/htmlmixed/)
- [MJML - Framework email responsive](https://mjml.io/) (optionnel, pour des emails plus complexes)

---

## 💡 Évolutions futures possibles

1. **File d'attente d'emails** : Utiliser Bull/BullMQ pour gérer les envois en background
2. **Logs d'envoi** : Table `email_logs` pour tracer tous les envois
3. **Multi-langue** : Templates par langue avec fallback
4. **MJML** : Utiliser MJML pour des emails responsive cross-client
5. **Webhooks** : Intégrer les webhooks SMTP pour le tracking (ouverture, clic)
