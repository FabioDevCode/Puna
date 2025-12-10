# Analyse des Controllers - Appels Base de Données

Cette analyse identifie tous les appels à la base de données dans les controllers pour déterminer la structure optimale des services.

---

## 📋 Résumé par Controller

| Controller | Modèles utilisés | Nombre d'opérations DB | Complexité |
|------------|------------------|------------------------|------------|
| auth.controller.js | User | 3 opérations | Simple |
| site.controller.js | Site, Form, SiteUser | 12 opérations | Moyenne |
| form.controller.js | Form, Site, Inbox | 8 opérations | Moyenne |
| inbox.controller.js | Inbox, Form, Site | 6 opérations | Moyenne |
| export.controller.js | Inbox, Form, Site | 4 opérations | Simple |
| dashboard.controller.js | Site, Form, Inbox | 15+ opérations (stats) | Élevée |
| admin.controller.js | User, Site, SiteUser | 14 opérations | Élevée |

---

## 🔍 Analyse Détaillée par Controller

### 1. **auth.controller.js**

**Modèles utilisés:** `User`

#### Opérations DB:
1. **dpFirstCoPost** - Première connexion
   - `User.findOne()` - Rechercher utilisateur par login + status pending
   - `user.update()` - Mettre à jour password et status

2. **dpConnect** - Connexion utilisateur
   - `User.update()` - Mettre à jour last_connection

**But:** Authentification et gestion des sessions utilisateurs

---

### 2. **site.controller.js**

**Modèles utilisés:** `Site`, `Form`, `SiteUser` (via helper)

#### Opérations DB:
1. **createSite** - Créer un site
   - `Site.create()` - Créer nouveau site avec control_code

2. **showSite** - Afficher un site
   - `Site.findByPk()` - Récupérer site par ID
   - `Site.findOne()` - Vérifier accès au site (avec siteWhereCondition)
   - `Form.findAll()` - Récupérer tous les formulaires du site

3. **deleteSite** - Supprimer un site
   - `Site.findByPk()` - Récupérer site
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `Form.destroy()` - Supprimer tous les formulaires associés
   - `site.destroy()` - Supprimer le site

4. **getSiteToken** - Obtenir token JWT
   - `Site.findByPk()` - Récupérer site
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - Génération JWT (pas DB)

5. **revokeSiteTokens** - Révoquer tokens
   - `Site.findByPk()` - Récupérer site
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `site.save()` - Mettre à jour control_code

**But:** CRUD complet des sites + gestion tokens/accès

---

### 3. **form.controller.js**

**Modèles utilisés:** `Form`, `Site`, `Inbox`

#### Opérations DB:
1. **createForm** - Créer un formulaire
   - `Site.findByPk()` - Vérifier existence du site
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `Form.create()` - Créer nouveau formulaire

2. **deleteForm** - Supprimer un formulaire
   - `Form.findByPk()` - Récupérer formulaire
   - `Site.findByPk()` - Vérifier site parent
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `form.destroy()` - Supprimer formulaire

3. **updateFormTemplateSave** - Mettre à jour template
   - `Form.findByPk()` - Récupérer formulaire
   - `Site.findByPk()` - Vérifier site parent
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `form.save()` - Sauvegarder template JSON

4. **getFormInbox** - Récupérer entrées inbox avec filtres
   - `Form.findByPk()` - Récupérer formulaire
   - `Site.findByPk()` - Vérifier site parent
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `Inbox.findAndCountAll()` - Récupérer inbox avec pagination + filtres JSON

5. **updateFormColumns** - Mettre à jour colonnes visibles
   - `Form.findByPk()` - Récupérer formulaire
   - `Site.findByPk()` - Vérifier site parent
   - `Site.findOne()` - Vérifier accès (siteWhereCondition)
   - `form.save()` - Sauvegarder colonnes JSON

**But:** CRUD formulaires + gestion template/colonnes + récupération inbox

---

### 4. **inbox.controller.js**

**Modèles utilisés:** `Inbox`, `Form`, `Site`

#### Opérations DB:
1. **showInbox** - Afficher une entrée inbox
   - `Inbox.findByPk()` - Récupérer inbox avec includes (Form > Site)
   - Vérification accès via include where condition

2. **deleteInbox** - Supprimer une entrée inbox
   - `Inbox.findByPk()` - Récupérer inbox avec includes
   - `inbox.destroy()` - Supprimer entrée
   - Suppression fichiers (filesystem, pas DB)

3. **downloadFile** - Télécharger un fichier
   - `Inbox.findByPk()` - Récupérer inbox avec includes
   - Vérification existence fichier (filesystem)

**But:** Affichage/suppression/téléchargement des soumissions inbox

---

### 5. **export.controller.js**

**Modèles utilisés:** `Inbox`, `Form`, `Site`

#### Opérations DB:
1. **downloadInboxZip** - Télécharger fichiers en ZIP
   - `Inbox.findByPk()` - Récupérer inbox avec includes
   - Génération ZIP (filesystem, pas DB)

2. **exportFormToExcel** - Exporter formulaire en Excel
   - `Form.findByPk()` - Récupérer formulaire avec Site
   - `Inbox.findAll()` - Récupérer toutes les entrées du formulaire
   - Génération Excel (pas DB)

**But:** Exports de données (ZIP, Excel)

---

### 6. **dashboard.controller.js**

**Modèles utilisés:** `Site`, `Form`, `Inbox` + **Raw SQL**

#### Opérations DB:
1. **dashboard** - Page principale
   - Appel helper `getSitesWithCounts()` (SQL complexe)

2. **getTopFroms** - Top 5 formulaires
   - **Raw SQL** - JOIN inbox + form + site, GROUP BY, ORDER BY

3. **getTopSiteForms** - Répartition formulaires du top site
   - **Raw SQL** - Deux requêtes (top site + forms breakdown)

4. **getInboxCounts** - Comptage par jour
   - **Raw SQL** - GROUP BY DATE(createdAt)

5. **getInboxPercentages** - Pourcentages today/7j/30j
   - Multiple `Inbox.count()` avec filtres temporels (6 requêtes)

6. **getInboxCountsBySite** - Comptage par site
   - **Raw SQL** - LEFT JOIN pour compter par site

7. **getInboxHeatmap** - Heatmap jour/heure
   - `Inbox.findAll()` - Récupérer toutes les entrées dans la période
   - Traitement en mémoire pour matrice 7x24

8. **getLastInboxEntry** - Dernière entrée
   - `Inbox.findOne()` - ORDER BY createdAt DESC

9. **allSite** - Liste tous les sites
   - Appel helper `getSitesWithCounts()`

**But:** Statistiques et graphiques du dashboard

---

### 7. **admin.controller.js**

**Modèles utilisés:** `User`, `Site`, `SiteUser`

#### Opérations DB:
1. **adminUsers** - Page liste utilisateurs
   - `Site.findAll()` - Récupérer sites disponibles

2. **adminUsersList** - API liste avec pagination
   - `User.findAndCountAll()` - Pagination + recherche + include creator

3. **adminUsersExportExcel** - Export Excel utilisateurs
   - `User.findAll()` - Tous les utilisateurs avec creator
   - Génération Excel (pas DB)

4. **adminCreateUser** - Créer utilisateur
   - `User.findOne()` - Vérifier si existe (email ou login)
   - `User.create()` - Créer utilisateur
   - `SiteUser.bulkCreate()` - Assigner sites

5. **adminDeleteUser** - Supprimer utilisateur
   - `User.findByPk()` - Récupérer utilisateur connecté
   - `SiteUser.destroy()` - Supprimer associations
   - `User.destroy()` - Supprimer utilisateur

6. **adminViewUser** - Voir utilisateur
   - `User.findByPk()` - Avec includes (creator + siteassignments)

7. **adminEditUser** - Page édition utilisateur
   - `User.findByPk()` - Avec includes (creator + siteassignments)
   - `Site.findAll()` - Récupérer sites disponibles

8. **adminUpdateUser** - Mettre à jour utilisateur
   - `User.update()` - Mettre à jour données utilisateur
   - `SiteUser.destroy()` - Supprimer anciennes assignations
   - `SiteUser.bulkCreate()` - Créer nouvelles assignations

**But:** Gestion complète des utilisateurs (CRUD + assignations sites)

---

## 📊 Patterns Identifiés

### 1. **Vérification d'accès récurrente**
- Présent dans: site, form, inbox, export controllers
- Pattern: `getSiteWhereCondition()` + `Site.findOne()` avec where
- **Candidat pour service:** `access.service.js`

### 2. **Opérations CRUD standards**
- Create, Read, Update, Delete sur: Site, Form, User, Inbox
- **Candidats pour services:** Un service par entité

### 3. **Requêtes statistiques complexes**
- dashboard.controller.js utilise beaucoup de **Raw SQL**
- Agrégations, GROUP BY, JOIN multiples
- **Candidat pour service:** `stats.service.js`

### 4. **Gestion des relations**
- SiteUser (many-to-many User ↔ Site)
- Form → Site (one-to-many)
- Inbox → Form (one-to-many)
- **Pattern:** Services doivent gérer les cascades

### 5. **Parsing JSON récurrent**
- `content`, `template`, `file_keys`, `columns` sont des champs JSON
- Parsing/stringify répété dans les controllers
- **Candidat pour helper:** `json.helper.js` ou intégrer dans services

---

## 🎯 Structure de Services Recommandée

Basée sur l'analyse ci-dessus, voici la structure optimale :

```
src/services/
├── auth.service.js          # Authentification, sessions, passwords
├── user.service.js          # CRUD users, assignations sites (SiteUser)
├── site.service.js          # CRUD sites, tokens, control_code
├── form.service.js          # CRUD forms, template, columns, file_keys
├── inbox.service.js         # CRUD inbox, filtres, fichiers
├── stats.service.js         # Statistiques dashboard (raw SQL)
├── export.service.js        # Exports Excel, ZIP, CSV
├── access.service.js        # Vérifications d'accès basées sur rôle
└── helpers/
    └── json.helper.js       # Parsing/stringify JSON sécurisé
```

### Détails par service :

#### **auth.service.js**
- `findUserByLogin(login, status)`
- `updateUserPassword(userId, hashedPassword)`
- `updateLastConnection(userId)`
- `verifyPassword(userId, plainPassword)`

#### **user.service.js**
- `getAllUsers(filters, pagination)`
- `getUserById(userId, includeRelations)`
- `createUser(userData)`
- `updateUser(userId, userData)`
- `deleteUser(userId)`
- `checkUserExists(email, login)`
- `assignSitesToUser(userId, siteIds)`
- `removeSitesFromUser(userId)`
- `getUserSites(userId)`

#### **site.service.js**
- `getAllSites(userId, userRole)` - Avec comptages
- `getSiteById(siteId, userId, userRole)`
- `createSite(domain, userId)`
- `deleteSite(siteId, userId, userRole)` - Cascade forms
- `updateSite(siteId, data)`
- `generateSiteToken(siteId)`
- `revokeSiteTokens(siteId)`
- `checkSiteAccess(siteId, userId, userRole)` - Centralise getSiteWhereCondition

#### **form.service.js**
- `getFormsBySite(siteId)`
- `getFormById(formId, includeRelations)`
- `createForm(formData)`
- `updateForm(formId, data)`
- `updateFormTemplate(formId, template)`
- `updateFormColumns(formId, columns)`
- `deleteForm(formId)` - Considérer cascade inbox
- `parseFormTemplate(form)` - Helper pour JSON
- `parseFormFileKeys(form)` - Helper pour JSON

#### **inbox.service.js**
- `getInboxById(inboxId, includeRelations)`
- `getInboxByForm(formId, filters, pagination)`
- `createInbox(inboxData)` - Pour l'API publique
- `deleteInbox(inboxId)` - Avec suppression fichiers
- `parseInboxContent(inbox)` - Helper pour JSON
- `getInboxFiles(inbox, form)` - Extraire fichiers du content

#### **stats.service.js**
- `getGlobalStats(userId, userRole)` - Sites avec comptages
- `getTopForms(userId, days)`
- `getTopSiteForms(userId, days)`
- `getInboxCountsByDay(userId, userRole, days)`
- `getInboxPercentages(userId, userRole)`
- `getInboxCountsBySite(userId)`
- `getInboxHeatmap(userId, userRole, days)`
- `getLastInboxEntry(userId, userRole)`

#### **export.service.js**
- `exportFormToExcel(formId, userId, userRole)` - Retourne buffer
- `exportUsersToExcel(filters)` - Pour admin
- `generateInboxZip(inboxId, userId, userRole)` - Retourne stream
- `exportFormToCSV(formId, userId, userRole)` - À créer

#### **access.service.js**
- `getSiteWhereCondition(userId, userRole)` - Déjà existe dans helper
- `checkSiteAccess(siteId, userId, userRole)` - Vérifie accès
- `checkFormAccess(formId, userId, userRole)` - Via site parent
- `checkInboxAccess(inboxId, userId, userRole)` - Via form → site
- `checkUserPermission(userId, entity, action)` - ACL

---

## 🔄 Migration Strategy

### Phase 1 : Services Fondamentaux
1. `access.service.js` - Base pour tous les autres
2. `user.service.js` - Indépendant
3. `site.service.js` - Dépend de access

### Phase 2 : Services Métier
4. `form.service.js` - Dépend de site + access
5. `inbox.service.js` - Dépend de form + access
6. `auth.service.js` - Simple, indépendant

### Phase 3 : Services Avancés
7. `stats.service.js` - Dépend de tous les autres
8. `export.service.js` - Dépend de form + inbox + user

### Phase 4 : Refactoring Controllers
- Remplacer appels models directs par appels services
- Controllers deviennent minces (HTTP handling only)
- Validation déplacée vers middlewares

---

## 📝 Notes Importantes

### Helpers à créer
- `json.helper.js` - Parsing JSON sécurisé (try/catch centralisé)
- Déplacer `getSiteWhereCondition()` dans `access.service.js`
- Déplacer `getSitesWithCounts()` dans `stats.service.js`

### Gestion d'erreurs
- Services doivent **throw** des erreurs typées
- Controllers doivent **catch** et retourner réponses HTTP
- Créer classes d'erreurs custom : `NotFoundError`, `ForbiddenError`, `ValidationError`

### Tests
- Chaque service doit avoir ses tests unitaires
- Mocker les models Sequelize
- Tester avec différents rôles (super_admin, owner, viewer)

### Performance
- Utiliser `raw: true` quand possible (déjà fait)
- Limiter les includes inutiles
- Paginer systématiquement les listes
- Cache pour stats dashboard (Redis?)

---

**Prochaines étapes :**
1. Créer la structure de dossiers `src/services/`
2. Commencer par `access.service.js`
3. Migrer progressivement les controllers
4. Écrire les tests au fur et à mesure
