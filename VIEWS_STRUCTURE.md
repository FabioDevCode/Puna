# 🎨 Structure des Vues - Recommandations

## 📊 État Actuel

```
src/views/
├── layouts/
│   ├── administration.hbs
│   ├── login.hbs
│   └── main.hbs
├── pages/
│   ├── admin.hbs
│   ├── admin_settings.hbs
│   ├── admin_user_edit.hbs
│   ├── admin_user_view.hbs
│   ├── admin_users.hbs
│   ├── dashboard.hbs
│   ├── error.hbs
│   ├── first_co.hbs
│   ├── login.hbs
│   ├── show_inbox.hbs
│   ├── site_list.hbs
│   └── site_show.hbs
└── partials/
    ├── _ui/
    │   ├── btn_download_all_files.hbs
    │   ├── btn_new_form.hbs
    │   ├── btn_new_site.hbs
    │   ├── btn_revoke_tokens.hbs
    │   ├── delete_form.hbs
    │   ├── delete_inbox_show.hbs
    │   ├── delete_site.hbs
    │   ├── form_columns_modal.hbs
    │   ├── form_filter_modal.hbs
    │   ├── form_template_modal.hbs
    │   ├── modal_create_user.hbs
    │   ├── modal_delete_inbox.hbs
    │   ├── modal_delete_user.hbs
    │   ├── search_site.hbs
    │   ├── site.hbs
    │   ├── stats.hbs
    │   ├── stats_inbox_counts.hbs
    │   ├── stats_inbox_heatmap.hbs
    │   ├── stats_inbox_percentages.hbs
    │   ├── stats_last_receive.hbs
    │   ├── stats_repartition_site.hbs
    │   ├── stats_tiny_counts.hbs
    │   ├── stats_top_froms.hbs
    │   └── stats_top_site_radial.hbs
    ├── admin_sidebar.hbs
    ├── head.hbs
    ├── left_menu.hbs
    ├── mobile_menu.hbs
    └── navbar.hbs
```

---

## ✨ Structure Proposée (Améliorée)

```
src/views/
├── layouts/
│   ├── admin.hbs              # Renommé de 'administration.hbs'
│   ├── auth.hbs               # Renommé de 'login.hbs'
│   └── main.hbs               # OK
│
├── pages/
│   ├── auth/                  # 🆕 Nouveau dossier
│   │   ├── login.hbs
│   │   └── first-login.hbs    # Renommé de 'first_co.hbs'
│   │
│   ├── admin/                 # 🆕 Nouveau dossier
│   │   ├── index.hbs          # Renommé de 'admin.hbs'
│   │   ├── settings.hbs       # Renommé de 'admin_settings.hbs'
│   │   └── users/             # 🆕 Sous-dossier
│   │       ├── list.hbs       # Renommé de 'admin_users.hbs'
│   │       ├── view.hbs       # Renommé de 'admin_user_view.hbs'
│   │       └── edit.hbs       # Renommé de 'admin_user_edit.hbs'
│   │
│   ├── dashboard/             # 🆕 Nouveau dossier
│   │   └── index.hbs          # Renommé de 'dashboard.hbs'
│   │
│   ├── sites/                 # 🆕 Nouveau dossier
│   │   ├── list.hbs           # Renommé de 'site_list.hbs'
│   │   └── show.hbs           # Renommé de 'site_show.hbs'
│   │
│   ├── inbox/                 # 🆕 Nouveau dossier
│   │   └── show.hbs           # Renommé de 'show_inbox.hbs'
│   │
│   └── errors/                # 🆕 Nouveau dossier
│       ├── 404.hbs            # 🆕 À créer
│       ├── 500.hbs            # 🆕 À créer
│       └── generic.hbs        # Renommé de 'error.hbs'
│
└── partials/
    ├── layout/                # 🆕 Nouveau dossier
    │   ├── head.hbs
    │   ├── navbar.hbs
    │   ├── left-menu.hbs      # Renommé de 'left_menu.hbs'
    │   ├── mobile-menu.hbs    # Renommé de 'mobile_menu.hbs'
    │   └── admin-sidebar.hbs  # Renommé de 'admin_sidebar.hbs'
    │
    ├── components/            # 🆕 Nouveau dossier (composants réutilisables)
    │   ├── buttons/           # 🆕 Sous-dossier
    │   │   ├── download-all.hbs       # Renommé de 'btn_download_all_files.hbs'
    │   │   ├── new-form.hbs           # Renommé de 'btn_new_form.hbs'
    │   │   ├── new-site.hbs           # Renommé de 'btn_new_site.hbs'
    │   │   └── revoke-tokens.hbs      # Renommé de 'btn_revoke_tokens.hbs'
    │   │
    │   ├── modals/            # 🆕 Sous-dossier
    │   │   ├── create-user.hbs        # Renommé de 'modal_create_user.hbs'
    │   │   ├── delete-user.hbs        # Renommé de 'modal_delete_user.hbs'
    │   │   ├── delete-inbox.hbs       # Renommé de 'modal_delete_inbox.hbs'
    │   │   ├── delete-form.hbs        # Renommé de 'delete_form.hbs'
    │   │   ├── delete-site.hbs        # Renommé de 'delete_site.hbs'
    │   │   ├── form-columns.hbs       # Renommé de 'form_columns_modal.hbs'
    │   │   ├── form-filter.hbs        # Renommé de 'form_filter_modal.hbs'
    │   │   └── form-template.hbs      # Renommé de 'form_template_modal.hbs'
    │   │
    │   ├── cards/             # 🆕 Sous-dossier
    │   │   ├── site.hbs       # Déplacé de '_ui/site.hbs'
    │   │   └── stats.hbs      # Déplacé de '_ui/stats.hbs'
    │   │
    │   └── search/            # 🆕 Sous-dossier
    │       └── site-search.hbs        # Renommé de 'search_site.hbs'
    │
    └── widgets/               # 🆕 Nouveau dossier (widgets/graphiques)
        ├── stats-inbox-counts.hbs          # Renommé
        ├── stats-inbox-heatmap.hbs         # Renommé
        ├── stats-inbox-percentages.hbs     # Renommé
        ├── stats-last-receive.hbs          # Renommé
        ├── stats-repartition-site.hbs      # Renommé
        ├── stats-tiny-counts.hbs           # Renommé
        ├── stats-top-froms.hbs             # Renommé
        └── stats-top-site-radial.hbs       # Renommé
```

---

## 📋 Convention de Nommage

### ✅ Bonnes Pratiques

| Type           | Convention                 | Exemple                                         |
| -------------- | -------------------------- | ----------------------------------------------- |
| **Pages**      | `kebab-case`               | `first-login.hbs`, `user-profile.hbs`           |
| **Layouts**    | `kebab-case`               | `admin.hbs`, `auth.hbs`                         |
| **Composants** | `kebab-case` descriptif    | `new-site.hbs`, `delete-user.hbs`               |
| **Modals**     | `kebab-case` sans préfixe  | `create-user.hbs` (pas `modal-create-user.hbs`) |
| **Widgets**    | `kebab-case` avec contexte | `stats-inbox-counts.hbs`                        |
| **Index**      | Toujours `index.hbs`       | Pour pages principales de section               |

### ❌ À Éviter

- ❌ `snake_case` : `admin_user_edit.hbs` → ✅ `edit.hbs` (dans dossier `admin/users/`)
- ❌ Préfixes redondants : `btn_`, `modal_`, `stats_` → Organisez par dossiers
- ❌ Noms vagues : `show.hbs` à la racine → ✅ `inbox/show.hbs`
- ❌ Abréviations : `first_co.hbs` → ✅ `first-login.hbs`

---

## 🗂️ Organisation par Domaine

### Principe

Chaque domaine fonctionnel a son propre dossier :

```
pages/
├── auth/          # Authentification
├── admin/         # Administration
├── dashboard/     # Tableau de bord
├── sites/         # Gestion des sites
├── inbox/         # Gestion des entrées
└── errors/        # Pages d'erreur
```

### Avantages

- ✅ **Navigation facile** : Trouver rapidement une vue
- ✅ **Maintenabilité** : Modifications isolées par domaine
- ✅ **Scalabilité** : Facile d'ajouter de nouveaux domaines
- ✅ **Clarté** : Structure reflète l'architecture de l'app

---

## 🔧 Organisation des Partials

### 1. **layout/** - Éléments de mise en page

```
partials/layout/
├── head.hbs           # <head> HTML
├── navbar.hbs         # Barre de navigation principale
├── left-menu.hbs      # Menu latéral gauche
├── mobile-menu.hbs    # Menu mobile
└── admin-sidebar.hbs  # Sidebar admin
```

### 2. **components/** - Composants réutilisables

#### **buttons/** - Boutons d'action

```
partials/components/buttons/
├── download-all.hbs
├── new-form.hbs
├── new-site.hbs
└── revoke-tokens.hbs
```

#### **modals/** - Fenêtres modales

```
partials/components/modals/
├── create-user.hbs
├── delete-user.hbs
├── delete-inbox.hbs
├── form-columns.hbs
└── form-filter.hbs
```

#### **cards/** - Cartes d'affichage

```
partials/components/cards/
├── site.hbs      # Carte site
└── stats.hbs     # Carte statistiques
```

#### **search/** - Composants de recherche

```
partials/components/search/
└── site-search.hbs
```

### 3. **widgets/** - Graphiques et widgets complexes

```
partials/widgets/
├── stats-inbox-counts.hbs
├── stats-inbox-heatmap.hbs
├── stats-inbox-percentages.hbs
└── stats-top-froms.hbs
```

---

## 🚀 Plan de Migration

### Phase 1 : Layouts (Priorité Haute)

- [ ] Renommer `administration.hbs` → `admin.hbs`
- [ ] Renommer `login.hbs` → `auth.hbs`
- [ ] Mettre à jour les références dans les contrôleurs

### Phase 2 : Pages par Domaine (Priorité Haute)

- [ ] Créer dossier `pages/auth/`
  - [ ] Déplacer `login.hbs`
  - [ ] Renommer `first_co.hbs` → `first-login.hbs`
- [ ] Créer dossier `pages/admin/`
  - [ ] Renommer `admin.hbs` → `index.hbs`
  - [ ] Créer sous-dossier `users/`
  - [ ] Déplacer et renommer fichiers users
- [ ] Créer dossier `pages/dashboard/`
- [ ] Créer dossier `pages/sites/`
- [ ] Créer dossier `pages/inbox/`
- [ ] Créer dossier `pages/errors/`

### Phase 3 : Partials - Layout (Priorité Moyenne)

- [ ] Créer dossier `partials/layout/`
- [ ] Déplacer les fichiers de navigation
- [ ] Appliquer kebab-case

### Phase 4 : Partials - Components (Priorité Moyenne)

- [ ] Créer structure `partials/components/`
- [ ] Organiser par type (buttons, modals, cards, search)
- [ ] Supprimer le dossier `_ui/`

### Phase 5 : Partials - Widgets (Priorité Basse)

- [ ] Créer dossier `partials/widgets/`
- [ ] Déplacer tous les `stats-*.hbs`
- [ ] Standardiser les noms

### Phase 6 : Nettoyage (Priorité Basse)

- [ ] Vérifier toutes les références
- [ ] Tester toutes les vues
- [ ] Supprimer anciens fichiers
- [ ] Mettre à jour la documentation

---

## 🎯 Bénéfices Attendus

### Avant

```
❌ pages/admin_user_edit.hbs
❌ partials/_ui/btn_new_form.hbs
❌ partials/_ui/stats_inbox_counts.hbs
```

**Problèmes :**

- Noms longs et peu clairs
- Tout au même niveau (pas de hiérarchie)
- Snake_case incohérent

### Après

```
✅ pages/admin/users/edit.hbs
✅ partials/components/buttons/new-form.hbs
✅ partials/widgets/stats-inbox-counts.hbs
```

**Avantages :**

- Structure claire et hiérarchique
- Noms courts et descriptifs
- kebab-case cohérent
- Facile à naviguer

---

## 💡 Règles d'Or

1. **Un fichier = Une responsabilité** : Chaque vue doit avoir un but unique
2. **Hiérarchie logique** : Organisez par domaine fonctionnel
3. **Noms explicites** : Le nom doit décrire précisément le contenu
4. **Cohérence** : Toujours utiliser kebab-case pour les fichiers
5. **index.hbs** : Pour la page principale d'une section
6. **Pas de préfixes** : Utilisez les dossiers au lieu de `modal_`, `btn_`, etc.

---

## 📚 Références

### Exemples de Chemins

| Ancien                                | Nouveau                                      | Raison                        |
| ------------------------------------- | -------------------------------------------- | ----------------------------- |
| `pages/admin_users.hbs`               | `pages/admin/users/list.hbs`                 | Organisation hiérarchique     |
| `pages/first_co.hbs`                  | `pages/auth/first-login.hbs`                 | Nom explicite + domaine       |
| `partials/_ui/btn_new_site.hbs`       | `partials/components/buttons/new-site.hbs`   | Structure + kebab-case        |
| `partials/_ui/modal_create_user.hbs`  | `partials/components/modals/create-user.hbs` | Suppression préfixe redondant |
| `partials/_ui/stats_inbox_counts.hbs` | `partials/widgets/stats-inbox-counts.hbs`    | Séparation widgets            |

---

## ⚠️ Points d'Attention

### Lors de la Migration

1. **Mettre à jour les contrôleurs** : Tous les `res.render('old_name')` → `res.render('domain/new-name')`
2. **Mettre à jour les partials** : Tous les `{{> old_partial}}` → `{{> path/to/new-partial}}`
3. **Tester chaque page** : Vérifier que rien n'est cassé
4. **Git commits atomiques** : Un commit par phase pour faciliter le rollback si nécessaire

### Configuration Handlebars

Vérifier que le moteur Handlebars supporte les sous-dossiers :

```javascript
// src/app.js
const hbs = create({
  defaultLayout: "main",
  layoutsDir: `${__dirname}/views/layouts`,
  partialsDir: `${__dirname}/views/partials`,
  extname: ".hbs",
  helpers: hbs_fn,
});

// Avec la nouvelle structure, Handlebars trouvera automatiquement :
// {{> layout/navbar }}
// {{> components/buttons/new-site }}
// {{> widgets/stats-inbox-counts }}
```

---

**Date de création :** 28 novembre 2025
**Statut :** Proposition - À valider et implémenter
