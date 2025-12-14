# Guide d'implémentation des Flash Messages avec Toasts

## 📋 Concept

Les **flash messages** permettent de stocker des messages dans la session côté serveur, qui seront affichés une seule fois côté client après une redirection, puis automatiquement supprimés.

### Cas d'usage typiques
- Confirmation d'une action (création, modification, suppression)
- Messages d'erreur après validation de formulaire
- Messages d'information après authentification
- Notifications après export de données

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Controller    │
│                 │
│ res.flash(...)  │ ← Ajoute un message dans req.session.flashMessages
└────────┬────────┘
         │
         ↓ redirect
┌─────────────────┐
│  Middleware     │
│ flashMessages   │ ← Injecte les messages dans res.locals.flashMessages
└────────┬────────┘
         │
         ↓ render
┌─────────────────┐
│   Vue (HBS)     │
│                 │ ← Les messages sont disponibles dans {{flashMessages}}
└────────┬────────┘
         │
         ↓ affichage
┌─────────────────┐
│  Script Client  │
│ toast-flash.js  │ ← Détecte et affiche les toasts, puis les supprime
└─────────────────┘
```

---

## 📝 Implémentation

### 1. Middleware Flash Messages

**Fichier:** `src/middlewares/flashMessages.js`

```javascript
/**
 * Middleware pour gérer les flash messages
 * Permet d'ajouter des messages dans la session qui seront affichés une seule fois
 */

/**
 * Initialise le système de flash messages
 * Ajoute la méthode res.flash() et injecte les messages dans res.locals
 */
function flashMessages(req, res, next) {
    // Initialiser le tableau de messages s'il n'existe pas
    if (!req.session.flashMessages) {
        req.session.flashMessages = [];
    }

    /**
     * Ajoute un message flash à la session
     * @param {string} type - Type de toast: 'puna', 'info', 'success', 'warning', 'error'
     * @param {string} text - Texte du message
     */
    res.flash = function (type, text) {
        req.session.flashMessages.push({ type, text });
    };

    // Injecter les messages dans res.locals pour les rendre disponibles dans les vues
    res.locals.flashMessages = req.session.flashMessages || [];

    // Vider les messages après les avoir injectés
    req.session.flashMessages = [];

    next();
}

module.exports = flashMessages;
```

---

### 2. Intégration dans app.js

**Fichier:** `src/app.js`

Ajouter le middleware juste après la configuration de la session :

```javascript
// ... imports existants
const flashMessages = require('./middlewares/flashMessages');

// ... configuration existante (express, session, etc.)

app.use(
    session({
        name: 'puna',
        secret: process.env.SESSION_SECRET,
        // ... reste de la config
    })
);

// ✅ Ajouter le middleware flash messages après la session
app.use(flashMessages);

// ... reste du code
```

---

### 3. Script Client pour afficher les Toasts

**Fichier:** `src/public/js/toast-flash.js`

```javascript
/**
 * Script pour afficher automatiquement les flash messages sous forme de toasts
 * Détecte les messages injectés dans la page et les affiche au chargement
 */

(function () {
    // Récupérer les messages depuis l'attribut data-flash-messages
    const flashContainer = document.getElementById('flash-messages');

    if (!flashContainer) {
        return;
    }

    const messagesJson = flashContainer.getAttribute('data-flash-messages');

    if (!messagesJson) {
        return;
    }

    try {
        const messages = JSON.parse(messagesJson);

        // Afficher chaque message avec un délai progressif pour éviter le chevauchement
        messages.forEach((message, index) => {
            setTimeout(() => {
                Toast({
                    text: message.text,
                    type: message.type,
                });
            }, index * 300); // Délai de 300ms entre chaque toast
        });
    } catch (error) {
        console.error('Erreur lors du parsing des flash messages:', error);
    }
})();
```

---

### 4. Intégration dans les vues

**Fichier:** `src/views/partials/layout/head.hbs` ou layout principal

Ajouter le conteneur pour les flash messages et le script :

```handlebars
{{!-- Conteneur invisible pour transporter les flash messages --}}
<div id="flash-messages" data-flash-messages="{{json flashMessages}}" style="display: none;"></div>

{{!-- Script Toastify (déjà présent) --}}
<link href="/plugins/toastify/toastify.css" rel="stylesheet"/>
<script src="/plugins/toastify/toastify.js"></script>

{{!-- Script Puna Toast (déjà présent) --}}
<script src="/js/puna.js"></script>

{{!-- ✅ Nouveau: Script pour les flash messages --}}
<script src="/js/toast-flash.js"></script>
```

**Note:** Handlebars ne dispose pas nativement d'un helper `json`. Il faut l'ajouter :

**Fichier:** `src/helpers/hbs_fn.js`

Ajouter ce helper :

```javascript
// ... helpers existants

json: function (context) {
    return JSON.stringify(context);
},
```

---

### 5. Utilisation dans les Controllers

**Exemples d'utilisation:**

```javascript
// ✅ Message de succès après création
exports.createSite = async (req, res) => {
    try {
        const site = await siteService.create(req.body);
        res.flash('success', 'Site créé avec succès !');
        return res.redirect('/admin/sites');
    } catch (error) {
        res.flash('error', 'Erreur lors de la création du site');
        return res.redirect('/admin/sites/new');
    }
};

// ✅ Message d'information après export
exports.exportData = async (req, res) => {
    try {
        await exportService.generateCSV(req.params.id);
        res.flash('info', 'Export en cours, vous recevrez un email');
        return res.redirect('/admin/exports');
    } catch (error) {
        res.flash('error', 'Échec de l\'export');
        return res.redirect('/admin/exports');
    }
};

// ✅ Message d'avertissement
exports.deleteSite = async (req, res) => {
    try {
        const hasData = await siteService.hasInboxData(req.params.id);
        if (hasData) {
            res.flash('warning', 'Ce site contient des données. Suppression impossible.');
            return res.redirect(`/admin/sites/${req.params.id}`);
        }
        await siteService.delete(req.params.id);
        res.flash('success', 'Site supprimé avec succès');
        return res.redirect('/admin/sites');
    } catch (error) {
        res.flash('error', 'Erreur lors de la suppression');
        return res.redirect('/admin/sites');
    }
};

// ✅ Multiples messages
exports.bulkAction = async (req, res) => {
    try {
        const results = await siteService.bulkDelete(req.body.ids);
        res.flash('success', `${results.deleted} sites supprimés`);
        if (results.errors > 0) {
            res.flash('warning', `${results.errors} suppressions ont échoué`);
        }
        return res.redirect('/admin/sites');
    } catch (error) {
        res.flash('error', 'Erreur lors de l\'opération groupée');
        return res.redirect('/admin/sites');
    }
};
```

---

## 🎨 Types de Messages disponibles

| Type      | Couleur       | Utilisation                              |
|-----------|---------------|------------------------------------------|
| `puna`    | Gris foncé    | Messages par défaut, branding           |
| `info`    | Bleu          | Informations neutres                    |
| `success` | Vert          | Confirmations d'actions réussies        |
| `warning` | Orange        | Avertissements, actions non critiques   |
| `error`   | Rouge         | Erreurs, échecs d'opérations            |

---

## 🔒 Sécurité

### Échappement XSS
Les messages sont automatiquement échappés par Handlebars lors de l'utilisation de `{{json flashMessages}}`. Pour les textes dans les toasts, Toastify utilise `innerText` par défaut (sauf si `escapeMarkup: false`).

### Validation des données
Il est recommandé de valider les messages avant de les ajouter :

```javascript
// Exemple de validation
res.flash = function (type, text) {
    const validTypes = ['puna', 'info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
        type = 'info';
    }
    if (typeof text !== 'string' || text.length === 0) {
        return;
    }
    if (text.length > 200) {
        text = text.substring(0, 200) + '...';
    }
    req.session.flashMessages.push({ type, text });
};
```

---

## 🧪 Tests

### Test manuel

**Créer une route de test:**

```javascript
// src/routes/default.routes.js
router.get('/test-flash', (req, res) => {
    res.flash('success', 'Ceci est un message de succès');
    res.flash('info', 'Ceci est un message d\'information');
    res.flash('warning', 'Ceci est un avertissement');
    res.flash('error', 'Ceci est une erreur');
    return res.redirect('/');
});
```

**Accéder à:** `http://localhost:3000/test-flash`

Vous devriez voir 4 toasts apparaître successivement après la redirection.

---

## 📊 Diagramme de flux complet

```
1. Utilisateur soumet un formulaire
   └─→ POST /admin/sites

2. Controller traite la requête
   └─→ res.flash('success', 'Site créé')
   └─→ res.redirect('/admin/sites')

3. Serveur redirige vers GET /admin/sites
   └─→ Middleware flashMessages s'exécute
       └─→ Récupère req.session.flashMessages
       └─→ Injecte dans res.locals.flashMessages
       └─→ Vide req.session.flashMessages

4. Vue est rendue
   └─→ {{json flashMessages}} génère le JSON dans data-flash-messages

5. Page chargée côté client
   └─→ toast-flash.js s'exécute
       └─→ Parse le JSON de #flash-messages
       └─→ Affiche chaque toast avec Toast()
       └─→ Les messages disparaissent après 3s
```

---

## 🚀 Migration progressive

### Phase 1: Installation
- [x] Créer le middleware `flashMessages.js`
- [x] Intégrer dans `app.js`
- [x] Ajouter le helper `json` dans `hbs_fn.js`
- [x] Créer le script `toast-flash.js`
- [x] Intégrer le script dans `head.hbs`

### Phase 2: Migration des controllers (exemple)
1. Identifier tous les `res.redirect()` dans les controllers
2. Remplacer les `console.log()` ou logs par `res.flash()`
3. Tester chaque redirection

**Exemple avant/après:**

```javascript
// ❌ Avant
exports.createSite = async (req, res) => {
    try {
        await siteService.create(req.body);
        console.log('Site créé'); // Invisible pour l'utilisateur
        return res.redirect('/admin/sites');
    } catch (error) {
        console.error(error);
        return res.redirect('/admin/sites/new');
    }
};

// ✅ Après
exports.createSite = async (req, res) => {
    try {
        await siteService.create(req.body);
        res.flash('success', 'Site créé avec succès !');
        return res.redirect('/admin/sites');
    } catch (error) {
        res.flash('error', 'Erreur lors de la création du site');
        return res.redirect('/admin/sites/new');
    }
};
```

---

## 🛠️ Améliorations possibles

### 1. Durée personnalisée par message
```javascript
res.flash = function (type, text, duration = 3000) {
    req.session.flashMessages.push({ type, text, duration });
};
```

### 2. Support des liens cliquables
```javascript
res.flash('info', 'Votre export est prêt', {
    destination: '/admin/exports/123',
    buttonText: 'Télécharger'
});
```

### 3. Limite de messages
```javascript
// Maximum 5 messages flash par session
if (req.session.flashMessages.length < 5) {
    req.session.flashMessages.push({ type, text });
}
```

### 4. Messages persistants (jusqu'à action utilisateur)
```javascript
res.flash('error', 'Action requise', { persistent: true, close: true });
```

---

## 📚 Ressources

- [Toastify.js Documentation](https://github.com/apvarun/toastify-js)
- [Express Session Documentation](https://github.com/expressjs/session)
- [Flash Messages Pattern](https://en.wikipedia.org/wiki/Post/Redirect/Get)

---

## ✅ Checklist d'implémentation

- [ ] Créer `src/middlewares/flashMessages.js`
- [ ] Ajouter le middleware dans `src/app.js` après la session
- [ ] Ajouter le helper `json` dans `src/helpers/hbs_fn.js`
- [ ] Créer `src/public/js/toast-flash.js`
- [ ] Ajouter le conteneur et le script dans `src/views/partials/layout/head.hbs`
- [ ] Créer une route de test `/test-flash`
- [ ] Tester l'affichage des 5 types de messages
- [ ] Migrer les controllers progressivement
- [ ] Supprimer la route de test

---

**Date de création:** 14 décembre 2025
**Version:** 1.0.0
