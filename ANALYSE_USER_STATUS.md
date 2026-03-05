# Analyse du champ `status` du modèle User

> Date de l'analyse : 5 mars 2026

## Sommaire

- [1. Valeurs de l'enum `status`](#1-valeurs-de-lenum-status)
- [2. Analyse de l'existant](#2-analyse-de-lexistant)
    - [2.1 Flux actuel du status](#21-flux-actuel-du-status)
    - [2.2 Fichiers impliqués](#22-fichiers-impliqués)
    - [2.3 Statuts non-utilisés côté backend](#23-statuts-non-utilisés-côté-backend)
    - [2.4 Lacunes identifiées](#24-lacunes-identifiées)
- [3. Suggestions d'intégration des statuts non-utilisés](#3-suggestions-dintégration-des-statuts-non-utilisés)
    - [3.1 `inactive` — Désactivation de compte](#31-inactive--désactivation-de-compte)
    - [3.2 `suspended` — Suspension temporaire](#32-suspended--suspension-temporaire)
    - [3.3 `banned` — Bannissement permanent](#33-banned--bannissement-permanent)
    - [3.4 `deleted` — Soft delete](#34-deleted--soft-delete)
- [4. Prérequis transversaux](#4-prérequis-transversaux)
- [5. Priorités suggérées](#5-priorités-suggérées)

---

## 1. Valeurs de l'enum `status`

Définies dans `src/models/attributes/user.attributes.json` :

| Valeur      | Utilisé actuellement | Description prévue                                                     |
| ----------- | -------------------- | ---------------------------------------------------------------------- |
| `pending`   | ✅ Oui               | Compte créé par un admin, en attente d'activation (première connexion) |
| `active`    | ✅ Oui               | Compte activé, l'utilisateur peut se connecter                         |
| `inactive`  | ❌ Non               | —                                                                      |
| `suspended` | ❌ Non               | —                                                                      |
| `banned`    | ❌ Non               | —                                                                      |
| `deleted`   | ❌ Non               | —                                                                      |

---

## 2. Analyse de l'existant

### 2.1 Flux actuel du status

```
Création par admin (POST /admin/users/create)
  └─> status = "pending" (pas de mot de passe)
        │
        ▼
Première connexion (POST /dp-first-co)
  └─> findUserByLogin(login, 'pending')
  └─> activateUserAccount() → status = "active"
        │
        ▼
Login (POST /dp-connect)
  └─> Passport LocalStrategy → WHERE { login, status: 'active' }
  └─> Seuls les utilisateurs "active" peuvent se connecter
        │
        ▼
Suppression (POST /admin/users/delete)
  └─> deleteUserWithRelations() → suppression PHYSIQUE (User.destroy)
```

### 2.2 Fichiers impliqués

| Fichier                                          | Utilisation du `status`                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/helpers/init_admin_user.js`                 | Crée le premier user admin avec `status: 'pending'`                                                                                                                |
| `src/services/auth.service.js`                   | `findUserByLogin(login, 'pending')` pour première connexion, `activateUserAccount()` passe à `'active'`, `authenticateUserByLogin()` filtre sur `status: 'active'` |
| `src/helpers/authHelper.js`                      | Passport LocalStrategy filtre `{ login, status: 'active' }`                                                                                                        |
| `src/services/user.service.js`                   | `createUserAdmin()` met `status: 'pending'` par défaut                                                                                                             |
| `src/controllers/auth.controller.js`             | Stocke `user.status` dans `req.session.user`                                                                                                                       |
| `src/controllers/admin/adminUsers.controller.js` | Affiche/formate le `status`, crée avec `status: 'pending'`                                                                                                         |
| `src/public/js/admin/users.js`                   | Badges pour **tous** les 6 statuts (le front est déjà prêt)                                                                                                        |
| `src/public/css/puna.css`                        | Classes CSS pour **tous** les statuts déjà définies                                                                                                                |
| `src/views/pages/admin/users/view.hbs`           | Affiche `badge_s_{{user.status}}`                                                                                                                                  |
| `src/views/pages/admin/users/edit.hbs`           | Affiche `badge_s_{{user.status}}` (lecture seule)                                                                                                                  |

### 2.3 Statuts non-utilisés côté backend

Les statuts `inactive`, `suspended`, `banned` et `deleted` ne sont référencés **nulle part dans le backend** (services, controllers, middlewares, routes). Seul le **front-end** (JS + CSS) les gère déjà pour l'affichage des badges.

### 2.4 Lacunes identifiées

1. **Pas de vérification du `status` à chaque requête** : le middleware `isConnected` (`src/helpers/authHelper.js`) ne vérifie que l'existence de `req.session.user`, jamais le status actuel en BDD. Un utilisateur dont le status est changé en BDD (ex: banni) **conserve sa session active** et peut continuer à utiliser l'application.

2. **Pas de route pour changer le statut** : aucun endpoint `POST /admin/users/:id/status` n'existe.

3. **Pas de champ dans la vue d'édition** : la page edit d'un utilisateur ne permet pas de modifier le statut ni le rôle.

4. **Suppression physique uniquement** : `deleteUserWithRelations()` fait un `User.destroy()` définitif, sans possibilité de récupération.

5. **Pas de cron lié aux utilisateurs** : le seul cron existant nettoie les fichiers temporaires. Aucune automatisation ne gère l'expiration de comptes ou de suspensions.

---

## 3. Suggestions d'intégration des statuts non-utilisés

### 3.1 `inactive` — Désactivation de compte

**Objectif** : Permettre la désactivation manuelle d'un compte par un admin, ou automatique après une période d'inactivité.

**Cas d'usage** :

- Un collaborateur quitte un projet → l'admin désactive son compte
- Un compte n'a pas eu de connexion depuis X mois → désactivation automatique

**Implémentation suggérée** :

| Composant                                        | Modification                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/user.service.js`                   | Ajouter `deactivateUser(userId)` → met `status: 'inactive'`                                                                          |
| `src/services/user.service.js`                   | Ajouter `reactivateUser(userId)` → remet `status: 'active'`                                                                          |
| `src/controllers/admin/adminUsers.controller.js` | Endpoint pour changer le statut                                                                                                      |
| `src/helpers/authHelper.js`                      | Dans `isConnected`, vérifier le status en BDD (ou en session si rafraîchi). Rediriger vers une page "compte désactivé" si `inactive` |
| `src/config/cron.js`                             | Nouveau cron : désactiver automatiquement les users sans connexion depuis > 6 mois (configurable) basé sur `last_connection`         |
| `src/views/pages/admin/users/edit.hbs`           | Ajouter un bouton/select pour changer le statut                                                                                      |

**Comportement attendu** :

- Un utilisateur `inactive` ne peut **pas se connecter** (Passport refuse)
- Un utilisateur `inactive` avec une session active est **déconnecté** au prochain accès
- Un admin peut **réactiver** le compte → retour à `active`

---

### 3.2 `suspended` — Suspension temporaire

**Objectif** : Permettre la suspension temporaire d'un compte avec une date de fin.

**Cas d'usage** :

- Comportement inapproprié → suspension de 7/30 jours
- Maintenance sur le périmètre d'un utilisateur → suspension le temps de l'intervention
- Suspension automatique après trop de tentatives de connexion échouées (complément au rate limiter existant)

**Implémentation suggérée** :

| Composant                                        | Modification                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/models/attributes/user.attributes.json`     | Ajouter un champ `suspended_until` (DATE, nullable)                                                             |
| `src/services/user.service.js`                   | Ajouter `suspendUser(userId, duration)` → met `status: 'suspended'` + `suspended_until`                         |
| `src/helpers/authHelper.js`                      | Passport et `isConnected` : si `suspended` et `suspended_until` passé → auto-réactiver ; sinon, bloquer l'accès |
| `src/config/cron.js`                             | Nouveau cron : vérifier les suspensions expirées toutes les heures → remettre en `active`                       |
| `src/controllers/admin/adminUsers.controller.js` | Interface pour suspendre avec choix de durée (1j, 7j, 30j, custom)                                              |
| Templates auth                                   | Page "Votre compte est suspendu jusqu'au [date]"                                                                |

**Comportement attendu** :

- Un utilisateur `suspended` ne peut **pas se connecter**
- Il voit un message avec la date de fin de suspension
- À expiration, le cron remet automatiquement en `active`
- Un admin peut lever la suspension manuellement

---

### 3.3 `banned` — Bannissement permanent

**Objectif** : Interdire définitivement l'accès à un utilisateur.

**Cas d'usage** :

- Violation grave des conditions d'utilisation
- Compte compromis → blocage immédiat
- Escalation après plusieurs suspensions

**Implémentation suggérée** :

| Composant                                        | Modification                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `src/services/user.service.js`                   | Ajouter `banUser(userId, reason)` → met `status: 'banned'`                        |
| `src/helpers/authHelper.js`                      | Passport : rejeter if `banned`. `isConnected` : détruire la session immédiatement |
| `src/controllers/admin/adminUsers.controller.js` | Bouton "Bannir" dans la vue user avec confirmation (mot de passe admin)           |
| `src/services/auth.service.js`                   | `findUserByLogin` : exclure les `banned` de la première connexion aussi           |
| Templates auth                                   | Page "Votre compte a été banni" (sans possibilité de reconnexion)                 |
| Audit logs                                       | Logger l'action de bannissement avec raison                                       |

**Comportement attendu** :

- Un utilisateur `banned` ne peut **ni se connecter, ni activer un compte pending**
- Sa session active est **immédiatement invalidée**
- Seul un `super_admin` peut débannir (retour à `active` ou `inactive`)
- L'action est traçable dans les logs d'audit

---

### 3.4 `deleted` — Soft delete

**Objectif** : Remplacer la suppression physique par un soft delete, permettant la récupération et l'audit.

**Cas d'usage** :

- Remplacer `User.destroy()` par `status: 'deleted'`
- Garder une trace des anciens utilisateurs pour audit/compliance
- Possibilité de restaurer un compte supprimé par erreur

**Implémentation suggérée** :

| Composant                                        | Modification                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/user.service.js`                   | Modifier `deleteUserWithRelations()` → au lieu de `User.destroy()`, mettre `status: 'deleted'`, vider le mot de passe, anonymiser l'email si souhaité |
| `src/services/user.service.js`                   | `findUsersWithFilters()` → filtrer les `deleted` par défaut (ajouter `where: { status: { [Op.ne]: 'deleted' } }`)                                     |
| `src/services/user.service.js`                   | Ajouter `restoreUser(userId)` → remettre en `inactive` (nécessite réactivation)                                                                       |
| `src/controllers/admin/adminUsers.controller.js` | Option pour afficher/masquer les utilisateurs supprimés. Bouton de restauration.                                                                      |
| `src/config/cron.js`                             | Optionnel : purge physique des `deleted` après X mois (rétention configurable)                                                                        |

**Comportement attendu** :

- L'utilisateur "supprimé" reste en base avec `status: 'deleted'`
- Il n'apparait plus dans les listes par défaut
- Ses données sont conservées pour audit
- Un admin peut le restaurer
- Après une période de rétention, un cron peut effectuer la purge physique

---

## 4. Prérequis transversaux

Avant ou en parallèle de l'intégration de chaque statut, certaines modifications transversales sont nécessaires :

### 4.1 Middleware de vérification du status (critique)

Créer un middleware `checkUserStatus` qui, à chaque requête authentifiée :

1. Vérifie le `status` du user en BDD (ou via un cache en session avec TTL)
2. Si `inactive`, `suspended` ou `banned` → détruire la session et rediriger
3. Si `deleted` → détruire la session et rediriger

**Emplacement** : `src/middlewares/checkUserStatus.js` (nouveau fichier)
**Montage** : après `isConnected` dans les routes protégées, ou directement intégré dans `isConnected`

### 4.2 Route de changement de statut

Ajouter `POST /admin/users/:id/status` dans `src/routes/default.routes.js` :

- Body : `{ status: 'inactive' | 'suspended' | 'banned' | 'active', suspended_until?: Date }`
- Protection : `roleAccess(['super_admin'])` (seuls les super_admin peuvent changer le statut)
- Log audit de chaque changement

### 4.3 Vue d'édition enrichie

Ajouter dans `src/views/pages/admin/users/edit.hbs` :

- Un select/dropdown pour changer le statut
- Un champ date pour la suspension (si statut = `suspended`)
- Un champ texte pour la raison (ban/suspend)

### 4.4 Pages d'erreur dédiées

Créer des pages dans `src/views/pages/errors/` ou `src/views/pages/auth/` :

- `account-inactive.hbs` → "Votre compte a été désactivé. Contactez un administrateur."
- `account-suspended.hbs` → "Votre compte est suspendu jusqu'au [date]."
- `account-banned.hbs` → "Votre compte a été banni."

---

## 5. Priorités suggérées

| Priorité       | Statut                             | Justification                                                                                                      |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 🔴 **Haute**   | Middleware `checkUserStatus`       | Prérequis pour tous les autres statuts. Sans lui, aucun changement de statut n'a d'effet sur les sessions actives. |
| 🔴 **Haute**   | Route + UI de changement de statut | Sans endpoint, impossible de changer un statut depuis l'interface.                                                 |
| 🟠 **Moyenne** | `inactive`                         | Besoin courant : désactiver un compte sans le supprimer. Facile à implémenter.                                     |
| 🟠 **Moyenne** | `deleted` (soft delete)            | Améliore la traçabilité et la sécurité des données. Remplace le `destroy()` actuel.                                |
| 🟡 **Basse**   | `banned`                           | Pertinent si l'application est amenée à avoir beaucoup d'utilisateurs ou des cas d'abus.                           |
| 🟡 **Basse**   | `suspended`                        | Le plus complexe (champ date, cron, auto-réactivation). À implémenter quand les autres sont en place.              |
