# 📝 Guide de Format des Messages de Commit

Ce projet utilise la convention **Conventional Commits** pour structurer les messages de commit de manière claire et cohérente.

## 🎯 Format Standard

```
<type>(<scope>): <description>

[corps optionnel]

[footer optionnel]
```

### Structure Détaillée

```
feat(auth): add password reset functionality

Implement password reset flow with email verification.
Users can now request a password reset link via email.

Closes #123
```

## 📋 Types de Commit

| Type | Description | Exemple |
|------|-------------|---------|
| `feat` | Nouvelle fonctionnalité | `feat(inbox): add file download button` |
| `fix` | Correction de bug | `fix(auth): resolve login redirect issue` |
| `docs` | Documentation uniquement | `docs(readme): update installation steps` |
| `style` | Formatage, indentation, etc. | `style(hbs): format all handlebars files` |
| `refactor` | Refactoring sans changement fonctionnel | `refactor(controllers): simplify site access logic` |
| `perf` | Amélioration des performances | `perf(api): optimize database queries` |
| `test` | Ajout ou modification de tests | `test(auth): add login validation tests` |
| `build` | Changements build/dépendances | `build(npm): update sequelize to v6.37.7` |
| `ci` | Changements CI/CD | `ci(husky): add pre-commit hook for linting` |
| `chore` | Tâches diverses (maintenance) | `chore(deps): update dependencies` |
| `revert` | Annulation d'un commit précédent | `revert: feat(inbox): add file download` |

## 🔖 Scopes Suggérés

Pour ce projet, voici les scopes principaux :

### Backend
- `auth` - Authentification et autorisation
- `api` - Routes API
- `controllers` - Contrôleurs
- `models` - Modèles Sequelize
- `middlewares` - Middlewares Express
- `helpers` - Fonctions utilitaires
- `config` - Configuration

### Frontend
- `views` - Templates Handlebars
- `layouts` - Layouts de pages
- `components` - Composants réutilisables
- `styles` - CSS/Styles
- `js` - JavaScript client

### Features
- `inbox` - Gestion des entrées inbox
- `forms` - Gestion des formulaires
- `sites` - Gestion des sites
- `admin` - Panel d'administration
- `dashboard` - Tableau de bord
- `export` - Export de données

### Infra
- `db` - Base de données/migrations
- `docker` - Configuration Docker
- `deps` - Dépendances npm

## ✍️ Règles d'Écriture

### Description (première ligne)

1. **Impératif présent** : "add" et non "added" ou "adds"
2. **Minuscule** : pas de majuscule après le type
3. **Pas de point** à la fin
4. **Maximum 72 caractères**
5. **En anglais** (convention internationale)

✅ **BON** :
```
feat(auth): add two-factor authentication
fix(inbox): resolve file upload validation
docs(api): update endpoint documentation
```

❌ **MAUVAIS** :
```
Added new feature.
Fix bug
updated the readme file
feat: J'ai ajouté l'authentification
```

### Corps (optionnel)

- Expliquer le **pourquoi** et le **contexte**, pas le **comment**
- Séparer de la description par une ligne vide
- Limiter à 72 caractères par ligne
- Peut contenir plusieurs paragraphes

```
fix(auth): prevent session fixation attacks

Previous implementation allowed session IDs to be reused
after logout. This could lead to session fixation attacks.

Now, session IDs are regenerated on each login and destroyed
completely on logout.
```

### Footer (optionnel)

Pour référencer des issues ou indiquer des breaking changes :

```
feat(api): change inbox response format

BREAKING CHANGE: Inbox API now returns data in {items, total} format
instead of flat array. Update all client implementations.

Closes #456
Refs #123, #789
```

## 📚 Exemples Pratiques

### Feature Simple
```
feat(forms): add form template editing
```

### Fix avec Contexte
```
fix(inbox): correct date formatting in inbox list

Dates were displayed in UTC instead of local timezone.
Now using dayjs for proper timezone conversion.

Fixes #234
```

### Refactoring Important
```
refactor(controllers): implement role-based access control

Replace direct ownership checks with getSiteWhereCondition()
helper to support viewer/editor roles accessing assigned sites.

Affects: site, form, inbox, export controllers
```

### Documentation
```
docs(hbs): add handlebars formatting guide
```

### Style/Formatting
```
style(hbs): apply automatic indentation to all templates
```

### Dépendances
```
build(npm): add glob package for file pattern matching
```

### Configuration
```
chore(prettier): configure handlebars plugin
```

### Multiple Changements
```
feat(rbac): implement complete role-based access control

- Add permissions.js with role definitions
- Create actionAccess and roleAccess middlewares
- Update all controllers with access checks
- Add Handlebars helpers for UI permissions

Closes #100, #101, #102
```

## 🚀 Workflow Recommandé

### 1. Commits Atomiques
Chaque commit doit représenter **une seule modification logique** :

✅ **BON** :
```bash
git commit -m "feat(auth): add login validation"
git commit -m "test(auth): add login validation tests"
git commit -m "docs(auth): document login flow"
```

❌ **MAUVAIS** :
```bash
git commit -m "fix various bugs and add new features"
```

### 2. Commits Fréquents
Committez souvent, mais de manière cohérente :

```bash
# Pendant le développement d'une feature
git commit -m "feat(inbox): add download button UI"
git commit -m "feat(inbox): implement download endpoint"
git commit -m "feat(inbox): add download permissions check"
git commit -m "test(inbox): add download integration tests"
```

### 3. Amend pour Corrections Mineures
Si vous devez corriger le dernier commit :

```bash
git commit --amend -m "feat(inbox): add file download with zip support"
```

## 🔧 Configuration Git

### Activer un Template de Commit

Créez un fichier `.gitmessage` :

```bash
# <type>(<scope>): <description>
#
# [corps optionnel]
#
# [footer optionnel]
#
# Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
# Scopes: auth, api, controllers, models, views, components, inbox, forms, sites, admin, etc.
```

Puis configurez Git :

```bash
git config commit.template .gitmessage
```

### Hooks Git avec Commitlint (optionnel)

Pour valider automatiquement les messages de commit :

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

Créez `commitlint.config.js` :

```javascript
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']
        ]
    }
};
```

## 📖 Ressources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)

## 💡 Tips

1. **Utilisez `git log --oneline`** pour voir l'historique propre
2. **Faites des commits avant chaque pause** pour ne pas perdre votre travail
3. **Relisez votre diff avant de committer** : `git diff --staged`
4. **Utilisez `git commit -v`** pour voir le diff pendant l'écriture du message
5. **En cas de doute**, un commit `chore` est acceptable

---

**Note** : Ces conventions sont des recommandations. L'important est la **cohérence** dans l'ensemble du projet.
