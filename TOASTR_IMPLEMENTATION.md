# Implémentation des Toastr/Flash Messages

## Système actuel

Le projet dispose d'un système de flash messages via:
- **Middleware**: `src/middlewares/flashMessages.js` - Ajoute `res.flash(type, text)`
- **Types disponibles**: `puna`, `info`, `success`, `warning`, `error`
- **Client**: `src/public/js/toast-flash.js` + `src/public/js/puna.js` (fonction `Toast()`)

---

## 1. Routes serveur avec redirection (utiliser `res.flash()`)

Ces routes font des redirections après une action. Le flash message sera automatiquement affiché.

### auth.controller.js ✅ Déjà implémenté
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /dp-connect` | Échec connexion | ✅ `res.flash('error', 'Identifiants incorrects.')` |

### site.controller.js
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /create-site` | Création site réussie | `res.flash('success', 'Site créé avec succès.')` |
| `POST /create-site` | Erreur | `res.flash('error', 'Erreur lors de la création du site.')` |
| `POST /delete-site/:id` | Suppression réussie | `res.flash('success', 'Site supprimé avec succès.')` |
| `POST /delete-site/:id` | Domaine incorrect | `res.flash('warning', 'Le nom de domaine ne correspond pas.')` |
| `POST /delete-site/:id` | Accès refusé | `res.flash('error', 'Accès refusé.')` |

### form.controller.js
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /create-form` | Création réussie | `res.flash('success', 'Formulaire créé avec succès.')` |
| `POST /create-form` | Erreur | `res.flash('error', 'Erreur lors de la création du formulaire.')` |
| `POST /delete-form` | Suppression réussie | `res.flash('success', 'Formulaire supprimé.')` |
| `POST /delete-form` | Accès refusé | `res.flash('error', 'Accès refusé.')` |
| `POST /form/:id/template` | Template mis à jour | `res.flash('success', 'Template enregistré.')` |
| `POST /form/:id/template` | Erreur | `res.flash('error', 'Erreur lors de la mise à jour du template.')` |

### inbox.controller.js
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /inbox/:id/delete` | Suppression réussie | `res.flash('success', 'Entrée supprimée.')` |
| `POST /inbox/:id/delete` | Erreur | `res.flash('error', 'Erreur lors de la suppression.')` |

### admin.controller.js
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /admin/users/create` | Utilisateur créé | `res.flash('success', 'Utilisateur créé avec succès.')` |
| `POST /admin/users/create` | Validation échouée | `res.flash('warning', 'Veuillez remplir tous les champs obligatoires.')` |
| `POST /admin/users/create` | Utilisateur existe | `res.flash('error', 'Un utilisateur avec cet email ou login existe déjà.')` |
| `POST /admin/users/delete` | Suppression réussie | `res.flash('success', 'Utilisateur supprimé.')` |
| `POST /admin/users/delete` | Mot de passe incorrect | `res.flash('error', 'Mot de passe incorrect.')` |
| `POST /admin/users/:id/update` | Mise à jour réussie | `res.flash('success', 'Utilisateur mis à jour.')` |
| `POST /admin/users/:id/update` | Erreur | `res.flash('error', 'Erreur lors de la mise à jour.')` |

### auth.controller.js
| Route | Action | Message suggéré |
|-------|--------|-----------------|
| `POST /dp-first-co` | Compte activé | `res.flash('success', 'Compte activé ! Vous pouvez maintenant vous connecter.')` |
| `POST /dp-first-co` | Mots de passe différents | `res.flash('error', 'Les mots de passe ne correspondent pas.')` |
| `POST /dp-first-co` | Login inconnu | `res.flash('error', 'Login inconnu.')` |
| `GET /dp-logout` | Déconnexion | `res.flash('info', 'Vous avez été déconnecté.')` |

---

## 2. Routes API appelées via JavaScript (utiliser `Toast()` côté client)

Ces routes retournent du JSON et sont appelées via `fetch()`. Il faut afficher le toast côté client.

### token.js → `/site/:id/token`
| Fichier JS | Action | Implémentation |
|------------|--------|----------------|
| `src/public/js/token.js` | Token copié | `Toast({ text: 'Token copié !', type: 'success' })` |
| `src/public/js/token.js` | Erreur | `Toast({ text: 'Erreur lors de la récupération du token.', type: 'error' })` |

### revoke_tokens.js → `/site/:id/revoke-tokens`
| Fichier JS | Action | Implémentation |
|------------|--------|----------------|
| `src/public/js/revoke_tokens.js` | Tokens révoqués | `Toast({ text: 'Tokens révoqués avec succès.', type: 'success' })` |
| `src/public/js/revoke_tokens.js` | Erreur | `Toast({ text: 'Erreur lors de la révocation.', type: 'error' })` |

### admin/users.js → `/admin/users/list`
| Fichier JS | Action | Implémentation |
|------------|--------|----------------|
| `src/public/js/admin/users.js` | Erreur chargement | `Toast({ text: 'Erreur lors du chargement des utilisateurs.', type: 'error' })` |

### Routes de téléchargement (iframe) - Pas de toast nécessaire
Ces routes téléchargent des fichiers via iframe, pas besoin de toast:
- `GET /inbox/:inboxId/download-zip` (download_zip.js)
- `GET /form/:id/export-excel` (export_excel.js)
- `GET /form/:id/export-csv` (export_csv.js)
- `GET /admin/users/export-excel`
- `GET /admin/users/export-csv`

### Routes stats/dashboard - API JSON (pas de toast action utilisateur)
Ces routes récupèrent des données pour les graphiques, pas d'action utilisateur:
- `GET /stats/inbox-counts`
- `GET /stats/inbox-percentages`
- `GET /stats/inbox-heatmap`
- `GET /stats/top-froms`
- `GET /stats/top-site-forms`
- `GET /stats/inbox-by-site`

### form.controller.js - API JSON
| Route | Fichier JS à créer/modifier | Action | Implémentation |
|-------|---------------------------|--------|----------------|
| `GET /form/:id/inbox` | Script inline ou dédié | Erreur | `Toast({ text: 'Erreur de chargement des données.', type: 'error' })` |
| `POST /form/:id/columns` | Script inline ou dédié | Colonnes mises à jour | `Toast({ text: 'Colonnes enregistrées.', type: 'success' })` |
| `POST /form/:id/columns` | Script inline ou dédié | Erreur | `Toast({ text: 'Erreur lors de la sauvegarde.', type: 'error' })` |

---

## 3. Récapitulatif des actions

### Priorité 1 - Actions utilisateur importantes
| Contrôleur | Méthode | Type Flash |
|------------|---------|------------|
| `admin.controller.js` | `adminCreateUser` | success/error |
| `admin.controller.js` | `adminDeleteUser` | success/error |
| `admin.controller.js` | `adminUpdateUser` | success/error |
| `site.controller.js` | `createSite` | success/error |
| `site.controller.js` | `deleteSite` | success/warning/error |
| `form.controller.js` | `createForm` | success/error |
| `form.controller.js` | `deleteForm` | success/error |
| `inbox.controller.js` | `deleteInbox` | success/error |

### Priorité 2 - Autres actions
| Contrôleur | Méthode | Type Flash |
|------------|---------|------------|
| `auth.controller.js` | `dpFirstCoPost` | success/error |
| `auth.controller.js` | `dpLogout` | info |
| `form.controller.js` | `updateFormTemplateSave` | success/error |

### Priorité 3 - JavaScript Client
| Fichier JS | Action | Type Toast |
|------------|--------|------------|
| `token.js` | Copie token | success/error |
| `revoke_tokens.js` | Révocation | success/error |
| `admin/users.js` | Erreur API | error |

---

## 4. Notes d'implémentation

### Côté serveur (res.flash)
```javascript
// Exemple dans site.controller.js
export const createSite = async (req, res) => {
    try {
        const site = await createSiteService(...);
        res.flash('success', 'Site créé avec succès.');
        return res.redirect(`/site/${site.id}/view`);
    } catch (err) {
        res.flash('error', 'Erreur lors de la création du site.');
        return res.redirect('/dashboard');
    }
};
```

### Côté client (Toast)
```javascript
// Exemple dans token.js
try {
    await navigator.clipboard.writeText(json.token);
    Toast({ text: 'Token copié !', type: 'success' });
} catch (err) {
    Toast({ text: 'Erreur lors de la copie.', type: 'error' });
}
```

---

## 5. Fichiers à modifier

### Contrôleurs (res.flash)
- [ ] `src/controllers/site.controller.js`
- [ ] `src/controllers/form.controller.js`
- [ ] `src/controllers/inbox.controller.js`
- [ ] `src/controllers/admin.controller.js`
- [ ] `src/controllers/auth.controller.js` (dpFirstCoPost, dpLogout)

### JavaScript Client (Toast)
- [ ] `src/public/js/token.js`
- [ ] `src/public/js/revoke_tokens.js`
- [ ] `src/public/js/admin/users.js`
