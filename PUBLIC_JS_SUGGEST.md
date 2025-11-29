# PUBLIC JS — Recommandations d'organisation et découpage

Date : 29 novembre 2025
Auteur : Analyse automatique & recommandations

## Objectif

Analyser le dossier `src/public/js/`, repérer motifs récurrents, points d'amélioration et proposer une arborescence et un plan de migration pour obtenir des fichiers plus modulaires, maintenables et testables.

## Résumé rapide

- Le dossier contient ~19 fichiers JS autonomes, majoritairement attachés via des <script> inline classiques.
- Beaucoup de fichiers utilisent `DOMContentLoaded` ou IIFE pour s'initialiser et manipulent directement le DOM.
- Patterns récurrents : fetch + rendu chart (ApexCharts), pagination tableau, modals, actions de boutons (download, revoke token), parsing JSON/template côté client.
- Quelques duplications notables : logique d'activation d'item dans la sidebar (`left_menu.js` et `admin_sidebar.js` très similaires), patterns de chargement/rafraîchissement pour les graphiques (`stats_*.js`), gestion des iframes pour download/export.
- `tabs.js` est un fichier relativement volumineux et monolithique qui orchestre plusieurs responsabilités (UI des tabs, modals colonnes/filtre, pagination et rendu de table). Il mérite d'être découplé.

## Objectifs de refactor

- Regrouper les scripts par domaine/fonction (admin, stats, inbox, utils)
- Extraire utilitaires réutilisés (fetchWrapper, domHelpers, modalHelpers, chartFactory)
- Rendre l'initialisation explicite (ex: `window.Puna.initXX()` ou modules ES importés si bundler)
- Réduire la duplication et faciliter les tests unitaires des fonctions pures
- Favoriser un petit namespace global `window.Puna = {}` si aucun bundler n'est utilisé

## Proposition d'arborescence

```
src/public/js/
├── index.js                    # point d'initialisation global (optionnel)
├── utils/
│   ├── fetch.js                # wrapper fetch, uniformiser erreurs/JSON
│   ├── dom.js                  # createEl, qs, qsa, delegate, addClass/removeClass
│   ├── modal.js                # helpers show/close modal, accessibility
│   ├── clipboard.js            # copy helpers, feedback UI
│   └── chart-factory.js        # factory wrappers pour ApexCharts
├── components/
│   ├── pagination.js           # pagination reusable (prev/next/limit)
│   ├── table-renderer.js       # helpers pour construire head/rows/renderTable
│   ├── badge.js                # small badge UI component
│   └── file-download.js        # iframe downloader helper
├── admin/
│   ├── users.js                # remplace admin_users.js (utilise utils/pagination)
│   ├── user-edit.js            # remplace admin_user_edit.js
│   └── sidebar.js              # remplace admin_sidebar.js
├── site/
│   ├── token.js                # token copying, revoke buttons
│   └── revoke.js               # revoke_tokens.js
├── inbox/
│   ├── tabs.js                 # découpage de l'actuel tabs.js (orchestration)
│   ├── columns-modal.js        # gestion modal colonnes
│   ├── filter-modal.js         # gestion modal filtres
│   └── delete.js               # delete inbox modal binding
├── export/
│   ├── excel.js                # export_excel.js
│   └── zip.js                  # download_zip.js
├── stats/
│   ├── inbox-counts.js
│   ├── inbox-heatmap.js
│   ├── percentages.js
│   ├── top-forms.js
│   └── charts.js               # wrappers/initializers communs (vide -> implementer)
└── search.js                   # possible migration vers components/search.js
```

## Principales recommandations détaillées

1. Namespace global minimal
    - Si aucun bundler (rollup/webpack) n'est utilisé, éviter la pollution globale :
      créer `window.Puna = window.Puna || {}` et exportez les inits :
      `window.Puna.AdminUsersInit = () => { ... }`.
    - Alternativement, charger chaque fichier via `type="module"` si cible moderne et si les templates acceptent les modules.

2. Extraire utilitaires
    - `fetch.js`: wrapper pour `fetch()` qui : gère `credentials: 'same-origin'`, vérifie `resp.ok`, parse JSON et renvoie {ok, json, error} ou lève une erreur uniforme.
    - `dom.js`: helpers pour `create`, `qs`, `qsa`, `delegate`, `onReady` (mais on peut continuer avec DOMContentLoaded), `toggleClass`, `clearChildren`.
    - `chart-factory.js`: wrapper pour créer, mettre à jour et détruire ApexCharts pour éviter duplication des options communs.

3. Découpage du code monolithique (`tabs.js`)
    - Actuel responsabilités multiples à séparer :
        - gestion modals (columns/modal_template_form, modal_filter)
        - rendu table (buildHead, buildRows, renderTable)
        - pagination et fetchPage
        - gestion d'état local actif (activeTpl, activeKeys...)
    - Proposition :
        - `inbox/tabs.js` : orchestrateur (prend un objet config, attache events, délègue au tableRenderer et modals)
        - `components/table-renderer.js` : buildHead/buildRows/renderTable pur, expose API `renderTable(items, keys, total)`
        - `inbox/columns-modal.js` : logic d'ouverture/enregistrement des colonnes
        - `inbox/filter-modal.js` : logic des filtres et génération de currentFilters
        - `components/pagination.js` : abstraction pour prev/next/selectLimit
    - Bénéfice : tests unitaires sur le renderer et les modals; `tabs.js` devient petit et lisible

4. Standardiser les charts
    - Les `stats_*.js` suivent le même pattern : fetch puis render via ApexCharts.
    - Extraire un `stats/chart-controller.js` qui :
        - reçoit `endpoint`, `el`, `renderOptions`, `mapper` et gère fetch + erreur + replay
        - évite duplication des fetch+try/catch

5. Réutiliser un helper pour les téléchargements
    - `download_zip.js` et `export_excel.js` utilisent le même pattern iframe + modal
    - Extraire `components/file-download.js` qui expose `triggerDownload(url, { modal, buttonState })`.

6. Consolidation des comportements de sidebar
    - `left_menu.js` et `admin_sidebar.js` sont très proches. Fusionner en `admin/sidebar.js` et utiliser des règles de matching centralisées.

7. Conventions et style
    - Nom des fichiers : kebab-case `admin-users.js` ou `users.js` dans `admin/`.
    - Eviter de mélanger `onclick` inline et event listeners modernes. Préférer addEventListener.
    - Uniformiser la stratégie d'initialisation :
        - Option A (sans bundler) : charger un petit `index.js` qui appelle explicitement les inits présents dans `window.Puna` selon la page.
        - Option B (module) : utiliser `type="module"` et importer seulement les modules nécessaires au template.

## Plan de migration proposé (étapes safe)

1. Créer `src/public/js/utils/fetch.js` et `src/public/js/utils/dom.js` et remplacer progressivement les fetchs et helpers dans 2 ou 3 fichiers tests (ex: `token.js`, `revoke_tokens.js`, `download_zip.js`).
2. Fusionner `left_menu.js` + `admin_sidebar.js` en `admin/sidebar.js` et déployer.
3. Extraire composants réutilisables : `file-download`, `pagination`, `table-renderer` (implémentation minimale). Adapter `admin_users.js` et `tabs.js` pour utiliser ces composants.
4. Découper `tabs.js` en `inbox/tabs.js`, `inbox/columns-modal.js`, `inbox/filter-modal.js`, `components/table-renderer.js`.
5. Regrouper les `stats_*.js` dans `stats/` et créer `stats/chart-factory.js`.
6. Remplacer les global listeners par des inits explicites (via `window.Puna` ou `type="module"`).
7. Tester manuellement chaque page et écrire tests unitaires pour `fetch.js` et `table-renderer.js`.

## Exemples concrets (patterns à adopter)

- Fetch wrapper minimal (`utils/fetch.js`):

```javascript
export async function apiGet(url) {
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || 'Network error');
    }
    return resp.json();
}
```

- Table renderer API (interface simplifiée) :

```javascript
// table-renderer.js
export function createTableRenderer({ headEl, bodyEl, columns }) {
    return {
        render(items, total) {
            /* builds head + rows */
        },
        clear() {
            /* clears head/body */
        },
    };
}
```

## Risques & points d'attention

- Certains templates peuvent compter sur la présence globale de fonctions/variables. Tester page par page.
- Migration vers `type="module"` implique que les scripts sont chargés différemment (CSP, chemins relatifs, support navigateur). Si besoin, rester sur scripts classiques et utiliser namespace `window.Puna`.
- Si vous utilisez des snippets inline dans les views qui appellent des fonctions globales, prévoir adaptateurs

## Priorités recommandées

- Haute : extraire `fetch` util et consolider les patterns fetch/error handling (améliore robustesse)
- Haute : découper `tabs.js` (forte complexité)
- Moyenne : regrouper `stats_*.js` autour d'un chart-factory
- Basse : migration complète vers ES Modules si vous voulez moderniser le pipeline

## Checklist rapide de migration (tickets)

- [ ] Ajouter `src/public/js/utils/fetch.js`
- [ ] Ajouter `src/public/js/utils/dom.js`
- [ ] Remplacer fetchs dans `token.js` & `revoke_tokens.js` par `utils/fetch.js`
- [ ] Créer `src/public/js/components/file-download.js` et migrer `download_zip.js`/`export_excel.js`
- [ ] Extraire `components/table-renderer.js` et l'utiliser dans `admin_users.js`
- [ ] Découper `tabs.js` (4 fichiers)
- [ ] Regrouper `stats` dans `src/public/js/stats/` et créer `chart-factory.js`

## Annexes — Fichiers présents (inventaire rapide)

- admin_sidebar.js
- admin_user_edit.js
- admin_users.js
- admin_users.js
- admin_sidebar.js
- admin_user_edit.js
- admin_users.js
- admin_sidebar.js
- charts.js (vide)
- download_zip.js
- export_excel.js
- left_menu.js
- mobile_menu.js
- revoke_tokens.js
- search.js
- stats\_\*.js (several)
- tabs.js
- token.js

## Conclusion

Le dossier `src/public/js/` est en bon état fonctionnel mais gagnera énormément en maintenabilité en regroupant les fichiers par responsabilité, en extrayant des utilitaires réutilisables (fetch/dom/chart) et en découpant les fichiers monolithiques (notamment `tabs.js`). Je peux, si vous le souhaitez, :

- Implémenter les fichiers utilitaires (`utils/fetch.js`, `utils/dom.js`) et migrer 2-3 fichiers comme preuve de concept.
- Commencer le découpage de `tabs.js` en modules et fournir un PR avec tests minimaux.

Que souhaitez-vous que j'exécute en premier ?
