# Analyse pour migration de MariaDB vers PostgreSQL

## Table des matières

1. [État des lieux de la compatibilité actuelle](#1-état-des-lieux-de-la-compatibilité-actuelle)
2. [Configuration Sequelize et connexion à la base de données](#2-configuration-sequelize-et-connexion-à-la-base-de-données)
3. [Génération dynamique des modèles Sequelize](#3-génération-dynamique-des-modèles-sequelize)
4. [Requêtes SQL brutes (`.query`)](#4-requêtes-sql-brutes-query)
5. [Gestion des sessions (`express-mysql-session`)](#5-gestion-des-sessions-express-mysql-session)
6. [Types de données et compatibilité](#6-types-de-données-et-compatibilité)
7. [Opérateurs Sequelize (`Op`)](#7-opérateurs-sequelize-op)
8. [Intégration Docker & Docker Compose](#8-intégration-docker--docker-compose)
9. [Variables d'environnement](#9-variables-denvironnement)
10. [Dépendances Node.js (`package.json`)](#10-dépendances-nodejs-packagejson)
11. [Récapitulatif des modifications recommandées](#11-récapitulatif-des-modifications-recommandées)
12. [Plan de migration recommandé](#12-plan-de-migration-recommandé)
13. [Précautions et conseils](#13-précautions-et-conseils)
14. [Références utiles](#14-références-utiles)

---

## 1. État des lieux de la compatibilité actuelle

### Architecture du projet

Puna est une application Node.js (Express 5 + Sequelize 6) utilisant actuellement **MariaDB 11** comme base de données relationnelle. Les principales couches d'accès aux données sont :

| Composant | Fichier(s) | Description |
|-----------|-----------|-------------|
| Configuration DB | `src/config/database.js` | Paramètres de connexion (host, port, dialect, etc.) |
| Instance Sequelize | `src/models/index.js` | Initialisation dynamique de Sequelize et chargement des modèles |
| Modèles | `src/models/*.models.js` | 5 modèles : User, Site, SiteUser, Form, Inbox |
| Attributs JSON | `src/models/attributes/*.attributes.json` | Définition des colonnes en JSON |
| Relations JSON | `src/models/relations/*.relations.json` | Définition des associations en JSON |
| Helper modèles | `src/helpers/models_hlps.js` | Construction des attributs, index et relations Sequelize |
| Requêtes brutes | `src/services/stats.service.js`, `src/controllers/admin/admin.controller.js` | 6 requêtes SQL via `sequelize.query()` |
| Session store | `src/app.js` | `express-mysql-session` pour le stockage des sessions |

### Évaluation globale

La compatibilité globale est **bonne** : la majeure partie de l'accès aux données passe par les méthodes ORM de Sequelize (`findAll`, `count`, `define`, etc.), qui sont abstraites du dialecte. Cependant, **plusieurs points nécessitent des adaptations** :

- ⚠️ Le session store (`express-mysql-session`) est **incompatible** avec PostgreSQL
- ⚠️ La configuration charset/collation (`utf8mb4`) est spécifique à MySQL/MariaDB
- ⚠️ L'index `PRIMARY` avec `using: 'BTREE'` est une syntaxe MySQL
- ⚠️ Le type `LONGTEXT` (via `DataTypes.TEXT('long')`) nécessite une vérification
- ✅ Les requêtes SQL brutes utilisent une syntaxe standard compatible
- ✅ Les opérateurs Sequelize (`Op.*`) sont compatibles tous dialectes
- ✅ Le dialecte est déjà paramétrable via `DB_DIALECT` dans `.env`
- ✅ Le validateur d'environnement accepte déjà `postgres` comme dialecte

---

## 2. Configuration Sequelize et connexion à la base de données

### Fichier : `src/config/database.example.js`

```javascript
export default {
    host: process.env.DB_IP || '127.0.0.1',
    port: process.env.DB_PORT || '3307',
    user: process.env.DB_USER || '',
    password: process.env.DB_PWD || '',
    database: process.env.DB_NAME || 'puna',
    dialect: process.env.DB_DIALECT || 'mariadb',
};
```

**Modifications recommandées :**

| Élément | Actuel | Recommandation |
|---------|--------|----------------|
| Port par défaut | `3307` (MariaDB) | Changer en `5432` pour PostgreSQL |
| Dialect par défaut | `mariadb` | Changer en `postgres` |

### Fichier : `src/models/index.js`

```javascript
const sequelize = new Sequelize(db_config.database, db_config.user, db_config.password, {
    host: db_config.host,
    dialect: db_config.dialect,
    port: db_config.port,
    logging: false,
    define: {
        timestamps: true,
    },
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
    timezone: '+00:00',
});
```

**Modifications recommandées :**

| Élément | Problème | Recommandation |
|---------|----------|----------------|
| `charset: 'utf8mb4'` | Spécifique MySQL/MariaDB. PostgreSQL utilise `UTF8` par défaut. | Retirer ou conditionner selon le dialecte. PostgreSQL gère nativement l'UTF-8 complet. |
| `collate: 'utf8mb4_general_ci'` | N'existe pas sous PostgreSQL. | Retirer ou conditionner. Sous PostgreSQL, la collation est gérée au niveau de la base (ex. `en_US.UTF-8`). |
| `timezone: '+00:00'` | Compatible PostgreSQL, mais la syntaxe recommandée par Sequelize pour PostgreSQL est `timezone: 'UTC'` ou via l'option `dialectOptions`. | Conserver ou adapter en `'UTC'`. |

**Exemple adapté pour PostgreSQL :**

```javascript
const sequelize = new Sequelize(db_config.database, db_config.user, db_config.password, {
    host: db_config.host,
    dialect: db_config.dialect,
    port: db_config.port,
    logging: false,
    define: {
        timestamps: true,
    },
    timezone: '+00:00',
});
```

> **Note :** Si le projet doit continuer à supporter les deux dialectes, il est possible de conditionner les options `charset` et `collate` selon la valeur de `db_config.dialect`.

---

## 3. Génération dynamique des modèles Sequelize

### Fonctionnement actuel

Les modèles sont générés dynamiquement via :

1. **`src/models/index.js`** : Parcourt les fichiers `*.models.js`, importe chaque modèle et appelle `associate()`.
2. **`src/helpers/models_hlps.js`** : Fournit `buildAttributes()`, `buildIndexes()` et `buildRelations()` pour construire les définitions Sequelize à partir de fichiers JSON.

Ce mécanisme est **compatible avec PostgreSQL** dans son principe, car Sequelize gère l'abstraction du dialecte au moment de la création des tables.

### Points d'attention dans `buildAttributes()`

**Fichier :** `src/helpers/models_hlps.js`

```javascript
case 'LONGTEXT':
    object[prop].type = DataTypes.TEXT('long');
    break;
```

| Type JSON | DataTypes Sequelize | MariaDB | PostgreSQL | Compatible ? |
|-----------|-------------------|---------|------------|-------------|
| `STRING(100)` | `DataTypes.STRING(100)` | `VARCHAR(100)` | `VARCHAR(100)` | ✅ Oui |
| `STRING(250)` | `DataTypes.STRING(250)` | `VARCHAR(250)` | `VARCHAR(250)` | ✅ Oui |
| `STRING` | `DataTypes.STRING(255)` | `VARCHAR(255)` | `VARCHAR(255)` | ✅ Oui |
| `UUID` | `DataTypes.UUID` | `CHAR(36)` | `UUID` (natif) | ✅ Oui (meilleur support natif sous PostgreSQL) |
| `LONGTEXT` | `DataTypes.TEXT('long')` | `LONGTEXT` | `TEXT` | ⚠️ Compatible, mais `TEXT('long')` n'a pas d'effet sous PostgreSQL (un seul type `TEXT` illimité). Fonctionne sans erreur. |
| `ENUM` | `DataTypes.ENUM(...)` | `ENUM(...)` en colonne | Crée un **type ENUM** personnalisé | ⚠️ Compatible mais comportement différent (voir section 6) |
| `INTEGER` | `DataTypes.INTEGER` | `INT` | `INTEGER` | ✅ Oui |
| `DATE` | `DataTypes.DATE` | `DATETIME` | `TIMESTAMP WITH TIME ZONE` | ✅ Oui |

### Points d'attention dans `buildIndexes()`

```javascript
indexes.push({
    name: 'PRIMARY',
    unique: true,
    using: 'BTREE',
    fields: [{ name: key }],
});
```

| Élément | Problème | Recommandation |
|---------|----------|----------------|
| `name: 'PRIMARY'` | Sous PostgreSQL, les index de clé primaire sont nommés automatiquement `<table>_pkey`. Le nom `PRIMARY` est une convention MySQL. | Retirer la propriété `name` ou la rendre dynamique. Sequelize gère la clé primaire via `primaryKey: true` dans l'attribut ; l'index explicite n'est pas nécessaire. |
| `using: 'BTREE'` | B-tree est le type par défaut sous PostgreSQL, mais la syntaxe `USING BTREE` dans une déclaration d'index est gérée différemment. | Retirer `using: 'BTREE'` ou conditionner. Sequelize génère automatiquement le bon type d'index. |

**Recommandation :** L'index explicite `PRIMARY` peut être supprimé car Sequelize crée automatiquement la clé primaire via l'attribut `primaryKey: true` défini dans les fichiers JSON. Si un index explicite est nécessaire, supprimer les propriétés `name` et `using` :

```javascript
indexes.push({
    unique: true,
    fields: [{ name: key }],
});
```

### Points d'attention dans `buildRelations()`

La fonction `buildRelations()` utilise les méthodes Sequelize standard (`belongsTo`, `hasMany`, `belongsToMany`) qui sont **entièrement compatibles** avec PostgreSQL. Aucune modification requise.

---

## 4. Requêtes SQL brutes (`.query`)

### Note importante : casse des identifiants dans les requêtes brutes

> ⚠️ **PostgreSQL est sensible à la casse des identifiants.** Les identifiants non quotés sont convertis en minuscules. Sequelize génère les noms de colonnes en camelCase par défaut (ex. `createdAt`, `updatedAt`) et les entoure de guillemets doubles dans le DDL. Dans les requêtes SQL brutes, il est recommandé d'utiliser `"createdAt"` (avec guillemets doubles) pour garantir la compatibilité. Cette remarque s'applique à **toutes les requêtes** listées ci-dessous.

### Inventaire des requêtes

6 requêtes SQL brutes ont été identifiées dans le projet :

#### 4.1 `src/services/stats.service.js`

**Requête 1 — `getTopForms` (lignes 69-79)**
```sql
SELECT i.fk_id_form AS fk_id_form, f.name AS form_name, s.domain AS site_domain, COUNT(i.id) AS cnt
FROM inbox i
JOIN form f ON f.id = i.fk_id_form
JOIN site s ON s.id = f.fk_id_site
WHERE s.fk_id_user = :userId
  AND i.createdAt BETWEEN :start AND :end
GROUP BY i.fk_id_form, f.name, s.domain
ORDER BY cnt DESC
LIMIT 5
```
- ✅ **Compatible PostgreSQL** : Syntaxe SQL standard. `BETWEEN`, `JOIN`, `GROUP BY`, `ORDER BY`, `LIMIT` sont identiques.
- ⚠️ `createdAt` nécessite des guillemets doubles (voir note ci-dessus).

**Requête 2 — `getTopSiteWithForms` (lignes 112-122)**
```sql
SELECT s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS total
FROM inbox i
JOIN form f ON f.id = i.fk_id_form
JOIN site s ON s.id = f.fk_id_site
WHERE s.fk_id_user = :userId
  AND i.createdAt BETWEEN :start AND :end
GROUP BY s.id, s.domain
ORDER BY total DESC
LIMIT 1
```
- ✅ **Compatible PostgreSQL**
- ⚠️ Même remarque sur `createdAt` (casse des identifiants).

**Requête 3 — `getTopSiteWithForms` (lignes 137-144)**
```sql
SELECT f.id AS form_id, f.name AS form_name, COUNT(i.id) AS cnt
FROM form f
LEFT JOIN inbox i ON i.fk_id_form = f.id AND i.createdAt BETWEEN :start AND :end
WHERE f.fk_id_site = :siteId
GROUP BY f.id, f.name
ORDER BY cnt DESC
```
- ✅ **Compatible PostgreSQL**
- ⚠️ Même remarque sur `createdAt`.

**Requête 4 — `getInboxCountsByDay` (lignes 185-193)**
```sql
SELECT DATE(i.createdAt) AS day_str, COUNT(i.id) AS cnt
FROM inbox i
JOIN form f ON f.id = i.fk_id_form
JOIN site s ON s.id = f.fk_id_site
WHERE s.fk_id_user = :userId
  AND i.createdAt BETWEEN :start AND :end
GROUP BY DATE(i.createdAt)
```
- ✅ **Compatible PostgreSQL** : La fonction `DATE()` est supportée par PostgreSQL pour extraire la date d'un timestamp.
- ⚠️ Même remarque sur `createdAt`.

**Requête 5 — `getInboxCountsBySite` (lignes 390-398)**
```sql
SELECT s.id AS site_id, s.domain AS site_domain, COUNT(i.id) AS cnt
FROM site s
LEFT JOIN form f ON f.fk_id_site = s.id
LEFT JOIN inbox i ON i.fk_id_form = f.id
WHERE s.fk_id_user = :userId
GROUP BY s.id, s.domain
ORDER BY s.domain ASC
```
- ✅ **Compatible PostgreSQL** : Syntaxe SQL standard.

#### 4.2 `src/controllers/admin/admin.controller.js`

**Requête 6 — Sessions actives (lignes 43-46)**
```sql
SELECT data FROM sessions WHERE expires > :now
```
- ⚠️ **Dépend du session store** : Cette requête accède directement à la table `sessions` créée par `express-mysql-session`. Lors de la migration vers un session store compatible PostgreSQL, le schéma de la table pourrait différer (noms de colonnes, types). À adapter selon le nouveau session store choisi (voir section 5).

### Résumé de compatibilité des requêtes brutes

| Requête | Fichier | Compatible ? | Action requise |
|---------|---------|-------------|----------------|
| getTopForms | stats.service.js | ✅ | Vérifier casse `"createdAt"` |
| getTopSiteWithForms (1) | stats.service.js | ✅ | Vérifier casse `"createdAt"` |
| getTopSiteWithForms (2) | stats.service.js | ✅ | Vérifier casse `"createdAt"` |
| getInboxCountsByDay | stats.service.js | ✅ | Vérifier casse `"createdAt"` |
| getInboxCountsBySite | stats.service.js | ✅ | Aucune |
| Sessions actives | admin.controller.js | ⚠️ | Adapter au nouveau session store |

### Recommandation importante : casse des identifiants

PostgreSQL est sensible à la casse des identifiants. Les identifiants non quotés sont convertis en minuscules. Sequelize, par défaut, génère des colonnes `createdAt` et `updatedAt` en camelCase et les entoure de guillemets doubles dans le DDL.

Dans les requêtes brutes, **deux options** :

1. **Ajouter `underscored: true`** dans la configuration Sequelize `define` pour que les colonnes soient nommées `created_at` et `updated_at` (en snake_case). Cela nécessite aussi de mettre à jour les requêtes brutes.

2. **Utiliser des guillemets doubles** dans les requêtes brutes :
   ```sql
   WHERE i."createdAt" BETWEEN :start AND :end
   ```

> **Recommandation** : L'option 2 est la plus simple pour ne pas casser les requêtes existantes. Il suffit d'ajouter des guillemets doubles autour de `createdAt` dans les requêtes SQL brutes.

---

## 5. Gestion des sessions (`express-mysql-session`)

### Problème identifié

Le projet utilise **`express-mysql-session`** (v3.0.3) pour stocker les sessions Express dans MariaDB :

```javascript
// src/app.js
import MySQLStoreConstructor from 'express-mysql-session';
const MySQLStore = MySQLStoreConstructor(session);
const sessionStore = new MySQLStore(database);
```

Ce package est **incompatible avec PostgreSQL** car il utilise le protocole MySQL/MariaDB pour communiquer avec la base de données.

### Solution recommandée : `connect-pg-simple`

Remplacer `express-mysql-session` par **`connect-pg-simple`**, qui est l'équivalent pour PostgreSQL.

**Installation :**
```bash
npm uninstall express-mysql-session
npm install connect-pg-simple
```

**Adaptation du code dans `src/app.js` :**

```javascript
// Avant (MariaDB)
import MySQLStoreConstructor from 'express-mysql-session';
const MySQLStore = MySQLStoreConstructor(session);
const sessionStore = new MySQLStore(database);

// Après (PostgreSQL)
import pgSession from 'connect-pg-simple';
const PgStore = pgSession(session);
const sessionStore = new PgStore({
    conString: `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`,
    tableName: 'sessions',
    createTableIfMissing: true,
});
```

### Impact sur la requête d'administration

La requête brute dans `admin.controller.js` qui consulte la table `sessions` devra être adaptée. Le schéma de la table `sessions` de `connect-pg-simple` est différent :

| Colonne (`express-mysql-session`) | Colonne (`connect-pg-simple`) | Type |
|----------------------------------|------------------------------|------|
| `session_id` | `sid` | `VARCHAR` |
| `data` | `sess` | `JSON` |
| `expires` | `expire` | `TIMESTAMP` |

**Adaptation de la requête :**

```javascript
// Avant (express-mysql-session)
const sessions = await models.sequelize.query(
    `SELECT data FROM sessions WHERE expires > :now`,
    { replacements: { now: nowTimestamp }, type: models.Sequelize.QueryTypes.SELECT }
);

// Après (connect-pg-simple)
const sessions = await models.sequelize.query(
    `SELECT sess AS data FROM sessions WHERE expire > NOW()`,
    { type: models.Sequelize.QueryTypes.SELECT }
);
```

> **Note :** Le champ `sess` de `connect-pg-simple` est de type `JSON`, tandis que `data` de `express-mysql-session` est une chaîne JSON. Le parsing `JSON.parse(session.data)` devra être adapté car `sess` sera déjà un objet JavaScript si le type `JSON` natif de PostgreSQL est utilisé.

---

## 6. Types de données et compatibilité

### ENUM

| Aspect | MariaDB | PostgreSQL |
|--------|---------|------------|
| Implémentation | Contrainte au niveau de la colonne | Crée un **type personnalisé** (ex. `enum_user_role`) |
| Ajout de valeurs | `ALTER TABLE ... MODIFY COLUMN ...` | `ALTER TYPE ... ADD VALUE ...` (irréversible) |
| Suppression de valeurs | Possible via `MODIFY COLUMN` | Impossible directement ; nécessite de recréer le type |
| Sequelize `sync()` | Gère l'ENUM directement | Gère la création du type ENUM ; les modifications ultérieures peuvent poser problème |

**Recommandation :** Les ENUM définis dans `user.attributes.json` (`role` et `status`) fonctionneront à la création initiale. Pour les évolutions futures, prévoir d'utiliser des migrations Sequelize plutôt que `sync()` pour gérer les modifications d'ENUM.

### LONGTEXT / TEXT

| Aspect | MariaDB | PostgreSQL |
|--------|---------|------------|
| `TEXT` | Max ~64 Ko | Illimité |
| `MEDIUMTEXT` | Max ~16 Mo | N'existe pas |
| `LONGTEXT` | Max ~4 Go | N'existe pas |
| `DataTypes.TEXT('long')` | Génère `LONGTEXT` | Génère `TEXT` (illimité) |

**Verdict :** ✅ Compatible — `DataTypes.TEXT('long')` sous PostgreSQL génère simplement `TEXT`, qui est illimité. Aucune modification requise.

### UUID

| Aspect | MariaDB | PostgreSQL |
|--------|---------|------------|
| Type natif | Pas de type UUID natif, stocké en `CHAR(36)` | Type **`UUID`** natif optimisé (16 octets) |
| Génération | Via application (Sequelize UUIDV4) | Possibilité d'utiliser `gen_random_uuid()` côté serveur |

**Verdict :** ✅ Compatible et amélioré — PostgreSQL offre un support natif UUID avec meilleure performance d'indexation.

### INTEGER avec auto-incrémentation

Le modèle `SiteUser` utilise `INTEGER` avec `autoIncrement: true` :

| Aspect | MariaDB | PostgreSQL |
|--------|---------|------------|
| Auto-incrémentation | `AUTO_INCREMENT` | `SERIAL` (Sequelize gère automatiquement la conversion) |

**Verdict :** ✅ Compatible — Sequelize convertit automatiquement `autoIncrement` en `SERIAL` pour PostgreSQL.

### DATE / DATEONLY

| Aspect | MariaDB | PostgreSQL |
|--------|---------|------------|
| `DataTypes.DATE` | `DATETIME` | `TIMESTAMP WITH TIME ZONE` |
| `DataTypes.DATEONLY` | `DATE` | `DATE` |

**Verdict :** ✅ Compatible — PostgreSQL offre un meilleur support des fuseaux horaires avec `TIMESTAMP WITH TIME ZONE`.

---

## 7. Opérateurs Sequelize (`Op`)

Les opérateurs Sequelize suivants sont utilisés dans le projet :

| Opérateur | Fichier(s) | Compatible PostgreSQL ? |
|-----------|-----------|----------------------|
| `Op.gte` | stats.service.js, inbox.service.js | ✅ Oui |
| `Op.lte` | stats.service.js | ✅ Oui |
| `Op.in` | inbox.service.js, form.service.js | ✅ Oui |
| `Op.between` | inbox.service.js | ✅ Oui |
| `Op.like` | user.service.js | ✅ Oui (voir note) |
| `Op.and` | access.service.js | ✅ Oui |
| `Op.or` | user.service.js | ✅ Oui |
| `Op.ne` | user.service.js | ✅ Oui |

> **Note sur `Op.like`** : Sous PostgreSQL, l'opérateur `LIKE` est sensible à la casse, contrairement à MariaDB qui est insensible à la casse par défaut. Si un comportement insensible à la casse est nécessaire, utiliser `Op.iLike` (spécifique PostgreSQL) ou configurer la collation.

---

## 8. Intégration Docker & Docker Compose

### Configuration actuelle (`docker-compose.yml`)

```yaml
db:
    image: mariadb:11
    container_name: puna_db
    restart: unless-stopped
    environment:
        MARIADB_ROOT_PASSWORD: ${DB_PWD}
        MARIADB_DATABASE: ${DB_NAME}
        MARIADB_USER: ${DB_USER}
        MARIADB_PASSWORD: ${DB_PWD}
    volumes:
        - puna_db_data:/var/lib/mysql
    expose:
        - '3306'
    healthcheck:
        test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized']
        interval: 10s
        timeout: 5s
        retries: 10
        start_period: 60s
    networks:
        - puna_net
```

### Modifications recommandées

```yaml
db:
    image: postgres:17
    container_name: puna_db
    restart: unless-stopped
    environment:
        POSTGRES_DB: ${DB_NAME}
        POSTGRES_USER: ${DB_USER}
        POSTGRES_PASSWORD: ${DB_PWD}
    volumes:
        - puna_db_data:/var/lib/postgresql/data
    expose:
        - '5432'
    healthcheck:
        test: ['CMD-SHELL', 'pg_isready -U ${DB_USER} -d ${DB_NAME}']
        interval: 10s
        timeout: 5s
        retries: 10
        start_period: 60s
    networks:
        - puna_net
```

### Tableau comparatif des changements Docker

| Élément | MariaDB | PostgreSQL | Impact |
|---------|---------|------------|--------|
| **Image** | `mariadb:11` | `postgres:17` (ou `postgres:17-alpine` pour une image plus légère) | Changement d'image |
| **Variables d'env** | `MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Renommage des variables |
| **Volume de données** | `/var/lib/mysql` | `/var/lib/postgresql/data` | Changement du chemin de montage |
| **Port** | `3306` | `5432` | Changement de port |
| **Healthcheck** | `healthcheck.sh --connect --innodb_initialized` | `pg_isready -U ${DB_USER} -d ${DB_NAME}` | Changement de commande de healthcheck |
| **Volume nommé** | `puna_db_data` | `puna_db_data` (peut rester identique, mais les données ne sont pas compatibles) | ⚠️ Les données MariaDB ne peuvent pas être réutilisées directement |

### Considérations supplémentaires Docker

- **Suppression de l'ancien volume** : Lors de la migration, il faudra supprimer le volume `puna_db_data` (`docker volume rm puna_db_data`) car les données MariaDB ne sont pas compatibles avec PostgreSQL.
- **Migration des données** : Exporter les données MariaDB avant la migration (`mysqldump` ou via un script Node.js), puis les importer dans PostgreSQL (`psql` ou via Sequelize).
- **Fichier `.dockerignore`** : Aucun changement nécessaire.
- **Dockerfile** : Aucun changement nécessaire car l'application Node.js ne contient pas de dépendance système à MariaDB (le driver est un package npm).

---

## 9. Variables d'environnement

### Fichier `.env.example`

| Variable | Valeur actuelle | Valeur PostgreSQL | Modification |
|----------|----------------|-------------------|-------------|
| `DB_IP` | `127.0.0.1` | `127.0.0.1` | Aucune |
| `DB_PORT` | `3306` | `5432` | ✏️ Changer |
| `DB_USER` | `root` | `puna` (ou autre) | ✏️ Adapter (PostgreSQL n'utilise pas `root` par convention) |
| `DB_PWD` | `your_password` | `your_password` | Aucune |
| `DB_NAME` | `puna` | `puna` | Aucune |
| `DB_DIALECT` | `mariadb` | `postgres` | ✏️ Changer |

### Fichier `src/config/env.validator.js`

Le validateur accepte déjà `postgres` comme dialecte valide :
```javascript
const ALLOWED_VALUES = {
    DB_DIALECT: ['mariadb', 'mysql', 'postgres', 'sqlite'],
};
```
✅ Aucune modification nécessaire.

---

## 10. Dépendances Node.js (`package.json`)

### Dépendances à modifier

| Action | Package | Version actuelle | Remplacement | Notes |
|--------|---------|-----------------|-------------|-------|
| ❌ Retirer | `mariadb` | `^3.4.5` | — | Driver MariaDB pour Sequelize |
| ➕ Ajouter | `pg` | (dernière stable) | — | Driver PostgreSQL pour Sequelize |
| ➕ Ajouter | `pg-hstore` | (dernière stable) | — | Sérialisation hstore pour Sequelize/PostgreSQL |
| ❌ Retirer | `express-mysql-session` | `^3.0.3` | — | Session store MySQL/MariaDB |
| ➕ Ajouter | `connect-pg-simple` | (dernière stable) | — | Session store PostgreSQL |

**Commandes :**
```bash
npm uninstall mariadb express-mysql-session
npm install pg pg-hstore connect-pg-simple
```

### Dépendances inchangées

- `sequelize` (`^6.37.7`) : Supporte nativement PostgreSQL. Aucune mise à jour nécessaire.
- Toutes les autres dépendances ne sont pas liées au dialecte de base de données.

---

## 11. Récapitulatif des modifications recommandées

### Modifications obligatoires

| # | Fichier | Modification | Priorité |
|---|---------|-------------|----------|
| 1 | `package.json` | Remplacer `mariadb` par `pg` + `pg-hstore` | 🔴 Haute |
| 2 | `package.json` | Remplacer `express-mysql-session` par `connect-pg-simple` | 🔴 Haute |
| 3 | `src/app.js` | Adapter l'initialisation du session store | 🔴 Haute |
| 4 | `src/models/index.js` | Retirer/conditionner `charset` et `collate` | 🔴 Haute |
| 5 | `docker-compose.yml` | Remplacer le service MariaDB par PostgreSQL | 🔴 Haute |
| 6 | `.env` / `.env.example` | Mettre à jour `DB_PORT`, `DB_DIALECT` | 🔴 Haute |
| 7 | `src/config/database.example.js` | Mettre à jour les valeurs par défaut (port, dialecte) | 🔴 Haute |

### Modifications recommandées

| # | Fichier | Modification | Priorité |
|---|---------|-------------|----------|
| 8 | `src/helpers/models_hlps.js` | Retirer `name: 'PRIMARY'` et `using: 'BTREE'` dans `buildIndexes()` | 🟡 Moyenne |
| 9 | `src/services/stats.service.js` | Ajouter des guillemets doubles autour de `createdAt` dans les requêtes SQL brutes | 🟡 Moyenne |
| 10 | `src/controllers/admin/admin.controller.js` | Adapter la requête des sessions au schéma `connect-pg-simple` | 🟡 Moyenne |

### Modifications optionnelles (améliorations)

| # | Fichier | Modification | Priorité |
|---|---------|-------------|----------|
| 11 | `src/services/*.service.js` | Remplacer `Op.like` par `Op.iLike` si le comportement insensible à la casse est attendu | 🟢 Basse |
| 12 | Projet global | Mettre en place un système de migrations Sequelize (`sequelize-cli`) pour gérer les évolutions de schéma | 🟢 Basse |
| 13 | `src/app.js` | Remplacer `sequelize.sync()` par des migrations pour un contrôle plus fin | 🟢 Basse |

---

## 12. Plan de migration recommandé

### Phase 1 : Préparation

1. **Sauvegarder les données** : Exporter toutes les données MariaDB (`mysqldump` ou export via Sequelize/scripts).
2. **Créer une branche Git** dédiée à la migration.
3. **Installer les nouvelles dépendances** : `pg`, `pg-hstore`, `connect-pg-simple`.
4. **Supprimer les anciennes dépendances** : `mariadb`, `express-mysql-session`.

### Phase 2 : Adaptation du code

5. **Modifier la configuration** : `database.js`, `.env`, `models/index.js`.
6. **Adapter le session store** dans `src/app.js`.
7. **Adapter `buildIndexes()`** dans `src/helpers/models_hlps.js`.
8. **Mettre à jour les requêtes brutes** avec guillemets doubles sur `createdAt`.
9. **Adapter la requête des sessions** dans `admin.controller.js`.

### Phase 3 : Infrastructure

10. **Modifier `docker-compose.yml`** pour PostgreSQL.
11. **Mettre à jour `.env.example`**.
12. **Supprimer l'ancien volume Docker** de données MariaDB.

### Phase 4 : Tests et validation

13. **Démarrer l'environnement** (`docker compose up`).
14. **Vérifier la création des tables** via `sequelize.sync()`.
15. **Tester toutes les fonctionnalités** : authentification, CRUD, statistiques, administration.
16. **Vérifier les requêtes brutes** et les sessions.
17. **Importer les données** (si migration de données existantes).

### Phase 5 : Finalisation

18. **Mettre à jour le README** et la documentation.
19. **Effectuer une revue de code** complète.
20. **Merger la branche** de migration.

---

## 13. Précautions et conseils

### Gestion de la casse des identifiants

PostgreSQL convertit tous les identifiants non quotés en **minuscules**. C'est la différence la plus impactante avec MariaDB. Sequelize utilise des guillemets doubles pour les identifiants par défaut sous PostgreSQL, ce qui préserve la casse (`"createdAt"`, `"updatedAt"`). Cependant, dans les requêtes SQL brutes, il est nécessaire d'ajouter explicitement les guillemets doubles.

### Transactions

Le projet n'utilise actuellement pas de transactions explicites. PostgreSQL offre un support transactionnel plus robuste (MVCC). Si des transactions sont ajoutées à l'avenir, elles fonctionneront de manière identique via Sequelize.

### Performances

- Les **UUID natifs** de PostgreSQL sont plus performants que les `CHAR(36)` de MariaDB pour l'indexation.
- Les **ENUM** sont stockés comme des types personnalisés sous PostgreSQL, ce qui peut affecter les performances de modification du schéma mais pas les requêtes.
- Le type **`TEXT`** sous PostgreSQL est aussi performant que `VARCHAR` pour les lectures ; il n'y a pas de pénalité comme sous MariaDB avec `LONGTEXT`.

### Séquences et auto-incrémentation

PostgreSQL utilise des **séquences** pour l'auto-incrémentation (`SERIAL`). Le comportement diffère de MariaDB :
- En cas de rollback d'une transaction, la séquence PostgreSQL ne revient **pas** en arrière (des "trous" dans les IDs sont possibles).
- Ce comportement n'est pas un problème pour le projet actuel (seul `SiteUser` utilise un `INTEGER` auto-incrémenté).

### Synchronisation du schéma (`sequelize.sync()`)

L'utilisation de `sequelize.sync()` sans option (`alter` ou `force`) crée les tables si elles n'existent pas mais ne les modifie pas. Ce comportement est **identique** sous PostgreSQL. Pour les évolutions de schéma en production, il est fortement recommandé d'utiliser des **migrations Sequelize** plutôt que `sync()`.

### Compatibilité `DATE()` dans les requêtes brutes

La fonction `DATE()` utilisée dans `getInboxCountsByDay` est compatible avec PostgreSQL. Alternativement, PostgreSQL propose `DATE_TRUNC('day', timestamp)` pour un contrôle plus fin, mais `DATE()` (cast implicite) fonctionne également.

---

## 14. Références utiles

### Sequelize et PostgreSQL

- [Sequelize — Getting Started](https://sequelize.org/docs/v6/getting-started/) — Guide d'installation et configuration pour différents dialectes
- [Sequelize — Dialect-Specific Things](https://sequelize.org/docs/v6/other-topics/dialect-specific-things/) — Différences entre dialectes MariaDB, MySQL, PostgreSQL, SQLite
- [Sequelize — Raw Queries](https://sequelize.org/docs/v6/core-concepts/raw-queries/) — Documentation sur `sequelize.query()`
- [Sequelize — Data Types](https://sequelize.org/docs/v6/core-concepts/model-basics/#data-types) — Correspondance des types de données par dialecte

### PostgreSQL

- [PostgreSQL Documentation officielle](https://www.postgresql.org/docs/current/) — Documentation complète
- [PostgreSQL — Data Types](https://www.postgresql.org/docs/current/datatype.html) — Types de données supportés
- [PostgreSQL — SQL Syntax](https://www.postgresql.org/docs/current/sql.html) — Référence de la syntaxe SQL
- [PostgreSQL vs MySQL — Key Differences](https://www.postgresql.org/about/) — Comparaison des fonctionnalités

### Session stores

- [`connect-pg-simple` — npm](https://www.npmjs.com/package/connect-pg-simple) — Session store Express pour PostgreSQL
- [`express-mysql-session` — npm](https://www.npmjs.com/package/express-mysql-session) — Session store actuel (référence)

### Docker et PostgreSQL

- [Image Docker officielle PostgreSQL](https://hub.docker.com/_/postgres) — Documentation de l'image Docker PostgreSQL
- [Docker Compose — PostgreSQL](https://github.com/docker-library/docs/tree/master/postgres) — Exemples de configuration Docker Compose
- [PostgreSQL Docker — Variables d'environnement](https://hub.docker.com/_/postgres#:~:text=Environment%20Variables) — `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, etc.
- [pg_isready — Healthcheck](https://www.postgresql.org/docs/current/app-pg-isready.html) — Outil de vérification de disponibilité

### Migration de données

- [pgloader](https://pgloader.io/) — Outil de migration automatique MySQL/MariaDB → PostgreSQL
- [AWS DMS](https://aws.amazon.com/dms/) — Service de migration de base de données (si applicable)
- [Sequelize Migrations](https://sequelize.org/docs/v6/other-topics/migrations/) — Guide des migrations Sequelize pour la gestion du schéma

### Différences MySQL/MariaDB vs PostgreSQL

- [PostgreSQL Wiki — MySQL vs PostgreSQL](https://wiki.postgresql.org/wiki/Things_to_find_out_about_when_moving_from_MySQL_to_PostgreSQL) — Guide officiel de migration
- [Identifier case sensitivity](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_upper_case_table_or_column_names) — Gestion de la casse des identifiants sous PostgreSQL
