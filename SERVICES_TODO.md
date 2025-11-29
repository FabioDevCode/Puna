# Services à créer - Analyse des contrôleurs

Ce document analyse chaque contrôleur du projet Puna et propose les services à créer pour séparer la logique métier de la logique de présentation.

---

## 📚 Principe de la couche Service

### Pourquoi créer des services ?

**Actuellement** : Les contrôleurs font tout - accès BDD, logique métier, validation, formatage
**Objectif** : Séparer les responsabilités selon le pattern MVC + Services

```
┌─────────────────┐
│   Controller    │  ← Reçoit les requêtes HTTP, valide les entrées, renvoie les réponses
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │  ← Logique métier pure, orchestration, calculs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Model       │  ← Accès direct à la base de données (Sequelize)
└─────────────────┘
```

### Avantages

- ✅ **Réutilisabilité** : Un service peut être utilisé par plusieurs contrôleurs
- ✅ **Testabilité** : Facile de tester la logique métier indépendamment
- ✅ **Maintenance** : Code mieux organisé, plus facile à comprendre
- ✅ **Séparation des responsabilités** : Chaque couche a un rôle clair

---

## 1️⃣ auth.controller.js

### Analyse

Gère l'authentification : première connexion, login/logout, mise à jour du dernier login.

### Services à créer

#### 📄 `src/services/auth.service.js`

**Responsabilités** :

- Vérification des identifiants
- Gestion du hashage des mots de passe
- Activation des comptes (first login)
- Mise à jour de la dernière connexion
- Validation des tokens/sessions

**Méthodes proposées** :

```javascript
// Activer un compte utilisateur avec mot de passe
async activateUserAccount(login, password, confirmPassword)

// Vérifier les identifiants et retourner l'utilisateur
async authenticateUser(login, password)

// Mettre à jour la dernière connexion
async updateLastConnection(userId)

// Valider le format d'un mot de passe
validatePasswordStrength(password)

// Comparer un mot de passe avec son hash
async verifyPassword(plainPassword, hashedPassword)

// Hasher un mot de passe
async hashPassword(password)
```

**Code actuel à déplacer** :

- ✅ Vérification user.status === 'pending'
- ✅ Comparaison password !== confirm_password
- ✅ bcrypt.hash() et bcrypt.compare()
- ✅ user.update() pour last_connection et status

**Bénéfices** :

- Logique d'authentification réutilisable dans d'autres contextes (API, CLI)
- Tests unitaires faciles sans dépendre de Express
- Validation centralisée des règles de mot de passe

---

## 2️⃣ dashboard.controller.js

### Analyse

Contrôleur très riche avec beaucoup de statistiques et d'agrégations SQL complexes.

### Services à créer

#### 📄 `src/services/statistics.service.js`

**Responsabilités** :

- Calculs statistiques complexes
- Agrégations sur les inbox
- Génération de données pour les graphiques
- Calculs de tendances et pourcentages

**Méthodes proposées** :

```javascript
// Top 5 des formulaires les plus actifs
async getTopForms(userId, days = 7)

// Répartition des formulaires du site le plus actif
async getTopSiteFormsDistribution(userId, days = 90)

// Comptage des inbox par jour
async getInboxCountsByDay(userId, days = 7)

// Calcul des pourcentages et tendances (aujourd'hui vs hier, 7j, 30j)
async getInboxTrends(userId)

// Comptage des inbox par site
async getInboxCountsBySite(userId)

// Génération de la heatmap (jours × heures)
async getInboxHeatmap(userId, days = 7)

// Récupération de la dernière entrée inbox
async getLastInboxEntry(userId)

// Statistiques globales agrégées
async getGlobalStatistics(userId)
```

**Code actuel à déplacer** :

- ✅ Toutes les requêtes SQL brutes complexes
- ✅ Logique de formatage des dates (dayjs)
- ✅ Calculs de pourcentages et tendances
- ✅ Construction des matrices (heatmap 7×24)
- ✅ Logique d'agrégation par jour/site/formulaire

**Bénéfices** :

- Contrôleur allégé (passe de 458 lignes à ~100 lignes)
- Statistiques réutilisables (ex: dashboard API mobile)
- Tests unitaires sur les calculs statistiques
- Performance : mise en cache possible au niveau service

---

#### 📄 `src/services/site.service.js`

**Responsabilités** :

- Gestion CRUD des sites
- Récupération des sites avec leurs compteurs
- Calculs liés aux sites (nombre de forms, inbox)

**Méthodes proposées** :

```javascript
// Récupérer tous les sites d'un utilisateur avec stats
async getSitesWithStats(userId)

// Créer un site
async createSite(userId, domain)

// Récupérer un site avec ses formulaires
async getSiteWithForms(siteId, userId)

// Vérifier si un site appartient à un utilisateur
async verifySiteOwnership(siteId, userId)

// Supprimer un site et ses dépendances
async deleteSiteWithDependencies(siteId, userId)

// Obtenir les statistiques globales d'un site
async getSiteStatistics(siteId)
```

**Code actuel à déplacer** :

- ✅ Appel à `getSitesWithCounts()` depuis helpers
- ✅ Logique de vérification de propriété des sites
- ✅ Calculs de statistiques par site

**Note** : Il existe déjà `src/helpers/site.helpers.js` qui fait une partie de ce travail. À terme, ce helper devrait être migré vers le service.

---

## 3️⃣ site.controller.js

### Analyse

Gère les sites : création, affichage, suppression, génération de tokens JWT.

### Services à créer

#### 📄 `src/services/site.service.js` (déjà mentionné ci-dessus)

**Méthodes supplémentaires** :

```javascript
// Générer un control_code aléatoire
generateControlCode()

// Générer un token JWT pour un site
async generateSiteToken(siteId, userId)

// Révoquer tous les tokens d'un site (régénérer control_code)
async revokeSiteTokens(siteId, userId)

// Valider un token JWT de site
async validateSiteToken(token)
```

**Code actuel à déplacer** :

- ✅ Génération du control_code avec `stringUtils.generateCode(16)`
- ✅ Signature JWT avec `jwt.sign()`
- ✅ Chiffrement du payload avec `encryptObject()`
- ✅ Vérification de la propriété du site avant opération
- ✅ Suppression cascade des formulaires

**Bénéfices** :

- Token JWT généré de manière cohérente
- Logique de révocation centralisée
- Validation de token réutilisable (middleware API)

---

## 4️⃣ form.controller.js

### Analyse

Gère les formulaires : création, suppression, mise à jour des templates et colonnes, récupération des données inbox avec filtres.

### Services à créer

#### 📄 `src/services/form.service.js`

**Responsabilités** :

- Gestion CRUD des formulaires
- Gestion des templates de formulaires
- Gestion des colonnes visibles
- Récupération des données inbox avec filtres
- Parsing et validation du JSON

**Méthodes proposées** :

```javascript
// Créer un formulaire
async createForm(userId, name, siteId)

// Supprimer un formulaire avec vérification de propriété
async deleteForm(formId, userId)

// Mettre à jour le template d'un formulaire
async updateFormTemplate(formId, userId, templateData)

// Mettre à jour les colonnes visibles
async updateFormColumns(formId, userId, columnsData)

// Récupérer les entrées inbox d'un formulaire avec filtres
async getFormInboxEntries(formId, userId, filters, pagination)

// Parser le template d'un formulaire
parseFormTemplate(form)

// Valider la structure d'un template
validateTemplateStructure(templateData)

// Appliquer des filtres sur le contenu JSON
buildWhereClauseFromFilters(formId, filters)
```

**Code actuel à déplacer** :

- ✅ Génération du code avec `stringUtils.generateCode(10)`
- ✅ Vérification de propriété via site.fk_id_user
- ✅ Logique de parsing JSON (template, columns, content)
- ✅ Construction des clauses WHERE complexes avec Sequelize
- ✅ Gestion des filtres sur JSON (JSON_EXTRACT, JSON_UNQUOTE)
- ✅ Pagination server-side
- ✅ Validation des payloads JSON

**Bénéfices** :

- Filtrage réutilisable dans d'autres contextes (exports, API)
- Validation centralisée des structures JSON
- Tests unitaires sur la logique de filtrage complexe

---

## 5️⃣ inbox.controller.js

### Analyse

Gère les entrées inbox : affichage détaillé, suppression avec nettoyage des fichiers, téléchargement de fichiers individuels.

### Services à créer

#### 📄 `src/services/inbox.service.js`

**Responsabilités** :

- Récupération des entrées inbox avec leurs relations
- Parsing du contenu JSON
- Gestion des fichiers associés
- Suppression avec nettoyage
- Calcul des métadonnées de fichiers

**Méthodes proposées** :

```javascript
// Récupérer une entrée inbox complète avec relations
async getInboxEntryWithRelations(inboxId, userId)

// Séparer les entrées fichiers et contenu
parseInboxContent(inbox, form)

// Obtenir les informations de type de fichier (icône, couleur)
getFileTypeInfo(filename)

// Supprimer une entrée inbox et ses fichiers
async deleteInboxWithFiles(inboxId, userId)

// Vérifier si un fichier appartient à une entrée inbox
async verifyFileOwnership(inboxId, filename, userId)

// Récupérer le chemin physique d'un fichier
getFilePhysicalPath(site, form, filename)

// Lister tous les fichiers d'une entrée inbox
listInboxFiles(inbox, form)
```

**Code actuel à déplacer** :

- ✅ Parsing du content JSON
- ✅ Parsing du template et file_keys
- ✅ Logique de séparation fileEntries / contentEntries
- ✅ Fonction `getFileTypeInfo()` (icônes, couleurs par extension)
- ✅ Suppression des fichiers du système de fichiers
- ✅ Validation de la propriété via les relations
- ✅ Construction des chemins avec `finalPathFor()`

**Bénéfices** :

- Logique de fichiers réutilisable (export, API)
- Tests unitaires sur le parsing et validation
- Gestion centralisée des types de fichiers

---

## 6️⃣ export.controller.js

### Analyse

Gère les exports : téléchargement ZIP de tous les fichiers d'une entrée, export Excel des données d'un formulaire.

### Services à créer

#### 📄 `src/services/export.service.js`

**Responsabilités** :

- Génération de fichiers ZIP
- Génération de fichiers Excel
- Collecte et formatage des données pour export
- Gestion des noms de fichiers

**Méthodes proposées** :

```javascript
// Créer un ZIP avec tous les fichiers d'une entrée inbox
async createInboxFilesZip(inboxId, userId)

// Exporter les données d'un formulaire en Excel
async exportFormToExcel(formId, userId)

// Collecter tous les fichiers d'une entrée inbox
async collectInboxFiles(inbox, form, site)

// Formater les données pour export Excel
formatDataForExcel(inboxEntries, template)

// Générer les colonnes Excel dynamiquement
generateExcelColumns(template, allKeys)

// Créer un workbook Excel avec style
createStyledWorkbook(data, columns, sheetName)

// Générer un nom de fichier d'export unique
generateExportFilename(prefix, formName)
```

**Code actuel à déplacer** :

- ✅ Logique de collecte des fichiers via fileKeys
- ✅ Utilisation d'archiver pour créer le ZIP
- ✅ Création du workbook ExcelJS
- ✅ Définition dynamique des colonnes
- ✅ Parsing du content JSON de chaque entrée
- ✅ Formatage des dates avec dayjs
- ✅ Application du style aux en-têtes

**Bénéfices** :

- Export réutilisable (API, scheduled jobs)
- Tests unitaires sur le formatage des données
- Gestion centralisée des formats d'export

---

## 7️⃣ admin.controller.js

### Analyse

Gère l'administration des utilisateurs : liste paginée, création, modification, suppression, assignation aux sites.

### Services à créer

#### 📄 `src/services/user.service.js`

**Responsabilités** :

- Gestion CRUD des utilisateurs
- Gestion des permissions et rôles
- Assignation des utilisateurs aux sites
- Recherche et filtrage des utilisateurs
- Validation des données utilisateur

**Méthodes proposées** :

```javascript
// Liste paginée des utilisateurs avec recherche
async getUsersList(filters, pagination)

// Créer un nouvel utilisateur
async createUser(userData, creatorId)

// Mettre à jour un utilisateur
async updateUser(userId, userData)

// Supprimer un utilisateur et ses assignations
async deleteUserWithAssignments(userId, currentUserId, password)

// Récupérer un utilisateur avec toutes ses relations
async getUserWithRelations(userId)

// Assigner des sites à un utilisateur
async assignSitesToUser(userId, siteIds)

// Vérifier si un email/login existe déjà
async checkUserExists(email, login)

// Vérifier le mot de passe d'un utilisateur
async verifyUserPassword(userId, password)

// Réinitialiser le statut d'un utilisateur
async resetUserStatus(userId)
```

**Code actuel à déplacer** :

- ✅ Construction des conditions de recherche (Op.like)
- ✅ Pagination avec findAndCountAll
- ✅ Formatage des dates (dayjs)
- ✅ Vérification d'existence (Op.or sur email/login)
- ✅ Gestion des SiteUser (bulkCreate, destroy)
- ✅ Vérification du mot de passe avec bcrypt
- ✅ Logique clear_password → status='pending'

**Bénéfices** :

- Gestion des utilisateurs réutilisable (API admin)
- Validation centralisée des données utilisateur
- Tests unitaires sur les règles métier (permissions, assignations)

---

#### 📄 `src/services/admin.service.js`

**Responsabilités** :

- Export Excel des utilisateurs
- Statistiques d'administration
- Gestion des paramètres globaux

**Méthodes proposées** :

```javascript
// Exporter la liste des utilisateurs en Excel
async exportUsersToExcel(filters)

// Obtenir les statistiques d'administration
async getAdminStatistics()

// Récupérer les paramètres globaux
async getGlobalSettings()

// Mettre à jour les paramètres globaux
async updateGlobalSettings(settings)
```

**Code actuel à déplacer** :

- ✅ Création du workbook Excel pour les utilisateurs
- ✅ Définition des colonnes et styles
- ✅ Formatage des données (dates, booléens)

---

## 🎯 Priorités d'implémentation

### Phase 1 : Services fondamentaux (Priorité haute)

1. **auth.service.js** - Critique pour la sécurité
2. **site.service.js** - Utilisé partout
3. **form.service.js** - Coeur métier de l'application

### Phase 2 : Services métier (Priorité moyenne)

4. **user.service.js** - Gestion des utilisateurs
5. **inbox.service.js** - Gestion des données entrées

### Phase 3 : Services utilitaires (Priorité basse)

6. **statistics.service.js** - Peut rester dans le contrôleur temporairement
7. **export.service.js** - Fonctionnalité secondaire
8. **admin.service.js** - Peu sollicité

---

## 📁 Structure proposée

```
src/
├── services/
│   ├── index.js                 # Export centralisé
│   ├── auth.service.js          # ✅ Authentification
│   ├── site.service.js          # ✅ Gestion des sites
│   ├── form.service.js          # ✅ Gestion des formulaires
│   ├── inbox.service.js         # ✅ Gestion des entrées
│   ├── user.service.js          # ✅ Gestion des utilisateurs
│   ├── statistics.service.js    # 📊 Statistiques et graphiques
│   ├── export.service.js        # 📦 Exports (ZIP, Excel)
│   └── admin.service.js         # 👤 Administration
```

---

## 💡 Bonnes pratiques à suivre

### 1. **Les services ne doivent PAS** :

- ❌ Dépendre de `req`, `res` (objets Express)
- ❌ Gérer les redirections ou render
- ❌ Accéder directement à `req.session`
- ❌ Logger avec console.log (utiliser un logger)

### 2. **Les services doivent** :

- ✅ Retourner des objets JavaScript purs
- ✅ Throw des erreurs personnalisées (ServiceError)
- ✅ Accepter des paramètres simples (userId, filters, data)
- ✅ Être testables unitairement
- ✅ Être réutilisables dans différents contextes

### 3. **Pattern recommandé** :

```javascript
// ❌ MAUVAIS - Dans le contrôleur
export const createSite = async (req, res) => {
    const { domain } = req.body;
    const userId = req.session.user?.id;
    const site = await models.Site.create({
        domain,
        fk_id_user: userId,
        control_code: stringUtils.generateCode(16),
    });
    return res.redirect(`/site/${site.id}/view`);
};

// ✅ BON - Séparé en service
// src/services/site.service.js
export const createSite = async (userId, domain) => {
    if (!domain) {
        throw new ServiceError('Domain is required');
    }

    const site = await models.Site.create({
        domain,
        fk_id_user: userId,
        control_code: stringUtils.generateCode(16),
    });

    return site; // Retourne l'objet pur
};

// src/controllers/site.controller.js
export const createSite = async (req, res) => {
    try {
        const { domain } = req.body;
        const userId = req.session.user?.id;

        const site = await siteService.createSite(userId, domain);

        return res.redirect(`/site/${site.id}/view`);
    } catch (err) {
        return res.redirect('/error');
    }
};
```

---

## 🧪 Tests à prévoir

Pour chaque service, prévoir des tests unitaires :

```javascript
// tests/unit/services/auth.service.test.js
describe('AuthService', () => {
    describe('activateUserAccount', () => {
        it('should activate a pending user', async () => {
            const result = await authService.activateUserAccount('john', 'Pass123', 'Pass123');
            expect(result.status).toBe('active');
        });

        it('should throw error if passwords do not match', async () => {
            await expect(authService.activateUserAccount('john', 'Pass123', 'Pass456')).rejects.toThrow(
                'Passwords do not match'
            );
        });
    });
});
```

---

## 📝 Notes de migration

### Étapes pour migrer un contrôleur :

1. **Identifier la logique métier** dans le contrôleur
2. **Créer le service** avec les méthodes appropriées
3. **Déplacer le code** du contrôleur vers le service
4. **Adapter le contrôleur** pour utiliser le service
5. **Écrire les tests unitaires** du service
6. **Vérifier que tout fonctionne** (tests d'intégration)

### Exemple de checklist :

- [ ] Créer `src/services/auth.service.js`
- [ ] Déplacer la logique de `dpFirstCoPost` vers `activateUserAccount()`
- [ ] Déplacer la logique de `dpConnect` vers `authenticateUser()`
- [ ] Adapter `auth.controller.js` pour utiliser le service
- [ ] Écrire tests unitaires pour `auth.service.js`
- [ ] Tester manuellement le flux complet
- [ ] Mettre à jour la documentation

---

## 🎯 Bénéfices attendus

### Avant (état actuel) :

- 🔴 Contrôleurs de 200-450 lignes
- 🔴 Logique métier mélangée avec HTTP
- 🔴 Difficile à tester
- 🔴 Code dupliqué entre contrôleurs
- 🔴 Dépendance forte à Express

### Après (avec services) :

- ✅ Contrôleurs de 50-100 lignes (responsabilité HTTP uniquement)
- ✅ Logique métier isolée et réutilisable
- ✅ Tests unitaires faciles
- ✅ Code mutualisé dans les services
- ✅ Indépendant du framework (migration future facilitée)

---

**Dernière mise à jour** : 29 novembre 2025
