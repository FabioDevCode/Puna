# Analyse du Dashboard — Puna

> Date : 16 mars 2026
> Contexte : outil open-source de gestion de formulaires, destiné à un usage petit/moyen.

---

## 1. État actuel (après nettoyage)

Les widgets **inbox-percentages**, **top-sites-radial** et **tiny-counts** ont été supprimés (code, routes, controller, service, tests).

Le dashboard comporte désormais **4 widgets** + les compteurs globaux :

| #   | Widget                | Endpoint                   | Description                                                    |
| --- | --------------------- | -------------------------- | -------------------------------------------------------------- |
| 1   | **inbox-counts**      | `GET /stats/inbox-counts`  | Graphique soumissions par jour (7j / 30j)                      |
| 2   | **top-forms**         | `GET /stats/top-froms`     | Tableau Top 5 des formulaires les plus actifs (7j / 30j)       |
| 3   | **site-distribution** | `GET /stats/inbox-by-site` | Répartition des soumissions totales par site (chart donut/bar) |
| 4   | **inbox-heatmap**     | `GET /stats/inbox-heatmap` | Heatmap jour × heure (7j, 30j, 90j, 180j)                      |

**Compteurs globaux** (server-side, passés au render) : nombre total de sites, formulaires et soumissions.

---

## 2. Suggestions d'amélioration par widget

### inbox-counts — Soumissions par jour

| Axe      | Suggestion                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **UX**   | Afficher le total de la période sélectionnée au-dessus du graphe (ex: "127 soumissions sur 7 jours") pour donner un chiffre clé immédiat. |
| **UX**   | Ajouter un tooltip au survol de chaque barre pour montrer la date formatée + le nombre exact.                                             |
| **Perf** | Le widget actuel est déjà bien optimisé (une seule requête SQL agrégée). RAS.                                                             |

### top-forms — Top 5 formulaires

| Axe      | Suggestion                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **UX**   | Ajouter une petite barre de progression visuelle à côté du compteur pour comparer les formulaires entre eux d'un coup d'œil. |
| **UX**   | Rendre chaque ligne cliquable pour amener directement à la inbox du formulaire concerné.                                     |
| **Data** | Afficher le nom du site à côté du formulaire (déjà renvoyé par l'API `site_domain`), utile quand on a plusieurs sites.       |

### site-distribution — Répartition par site

| Axe      | Suggestion                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **UX**   | Simplifier le chart actuel (donut/bar) vers une liste compacte avec barres horizontales proportionnelles. Plus lisible avec 1-3 sites. |
| **UX**   | Afficher "Aucune donnée" proprement quand il n'y a qu'un seul site (le chart est peu utile dans ce cas).                               |
| **UX**   | Rendre chaque site cliquable pour amener à sa page de détail.                                                                          |
| **Perf** | La requête SQL est déjà bien agrégée. RAS.                                                                                             |

### inbox-heatmap — Intensité jour × heure

| Axe      | Suggestion                                                                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perf** | **Prioritaire** — Actuellement charge tous les `Inbox` via `findAll` puis itère en JS. Remplacer par une agrégation SQL (`GROUP BY DAYOFWEEK(createdAt), HOUR(createdAt)`) pour ne récupérer que les compteurs. Gain énorme sur 90j/180j. |
| **UX**   | Réduire les options de période à **7j / 30j** (retirer 90j et 180j). Sur petit volume, 90-180 jours est rarement pertinent et coûteux.                                                                                                    |
| **UX**   | Ajouter un tooltip au survol de chaque cellule indiquant le jour + heure + nombre exact de soumissions.                                                                                                                                   |

### Compteurs globaux (server-side)

| Axe      | Suggestion                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perf** | **`getSitesWithCounts`** fait N+1 requêtes (1 par site). Remplacer par une seule requête agrégée avec `LEFT JOIN` + `GROUP BY`.                                |
| **UX**   | Ajouter un compteur "Soumissions aujourd'hui" à côté des totaux. Simple et utile au quotidien (1 seul `COUNT` supplémentaire).                                 |
| **Code** | La fonction `getGlobalStats` (ligne ~17 du service) semble inutilisée (les compteurs passent par `getGlobalStatsFromSites`). À supprimer pour alléger le code. |

---

## 3. Améliorations techniques transverses

| Priorité    | Suggestion                                                                       |
| ----------- | -------------------------------------------------------------------------------- |
| **Haute**   | Optimiser `getInboxHeatmap` — agrégation SQL au lieu de `findAll` + itération JS |
| **Haute**   | Optimiser `getSitesWithCounts` — supprimer le pattern N+1                        |
| **Moyenne** | Supprimer la fonction `getGlobalStats` inutilisée dans `stats.service.js`        |
| **Basse**   | Corriger la typo dans la route `/stats/top-froms` → `/stats/top-forms`           |
| **Basse**   | Supprimer le partial commenté `last-receive` si non prévu, ou l'implémenter      |

---

## 4. Layout actuel du dashboard

```
┌──────────────────────────────────────────────────────┐
│  [Sites: 3]    [Formulaires: 12]    [Inbox: 847]    │  ← Compteurs globaux
├──────────────────────────────────────────────────────┤
│                                                      │
│  📊 Soumissions par jour (7j / 30j)                  │  ← inbox-counts
│  ▁▂▃▅▇▅▃▂▁▃▅▇█▅▃                                    │
│                                                      │
├──────────────────────────────┬───────────────────────┤
│                              │                       │
│  🏆 Top 5 formulaires       │  🌐 Répartition sites │  ← top-forms + site-distrib
│  1. Contact — 42            │  puna.dev ████░░ 60%  │
│  2. Newsletter — 28         │  blog.fr  ██░░░░ 30%  │
│  3. ...                     │  test.fr  █░░░░░ 10%  │
│                              │                       │
├──────────────────────────────┴───────────────────────┤
│                                                      │
│  🔥 Heatmap jour × heure (7j / 30j)                  │  ← inbox-heatmap
│  Lu ░░▒▒▓▓██▓▓▒▒░░░░░░░░░░░░                        │
│  Ma ░░░▒▒▓▓██████▓▓▒▒░░░░░░░                        │
│  ...                                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

_Dernière mise à jour : 16 mars 2026 — après suppression de inbox-percentages, top-sites-radial et tiny-counts._
