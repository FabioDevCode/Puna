# Ce qui MANQUE — par priorité

## Critique (bloquant production/crédibilité GitHub)

| #   | Manque                                  | Pourquoi c'est critique                                                                                                           |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Aucun test automatisé**               | 0 fichier test, 0 framework de test, pas de script `test` dans package.json. C'est le plus gros frein à la crédibilité sur GitHub |
| 2   | **Pas de CI/CD** (`.github/workflows/`) | Pas de pipeline automatique — lint, tests, build Docker ne sont pas vérifiés sur chaque push                                      |
| 3   | **Pas de migrations Sequelize**         | `sequelize.sync()` en production = risque de perte de données. Pas de versioning du schéma DB                                     |

## Important (préparation production)

| #   | Manque                                           | Impact                                                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 4   | **CryptoJS avec IV fixe** (`KIV`)                | Le même texte produit toujours le même chiffré. L'IV devrait être aléatoire par opération |
| 5   | **Pas de reset mot de passe**                    | Fonctionnalité attendue — `nodemailer` est déjà dans les deps mais pas utilisé            |
| 6   | **Pas de documentation API** (Swagger/OpenAPI)   | Les intégrateurs n'ont aucune doc pour utiliser l'API publique                            |
| 7   | **Pas de validation input structurée** (Joi/Zod) | Validation dispersée dans les controllers, pas de schéma centralisé                       |
| 8   | **Version `0.0.1`** dans package.json            | Pas crédible pour une release — passer à `1.0.0`                                          |

## Souhaitable (améliorations)

| #   | Manque                                      | Impact                                                                      |
| --- | ------------------------------------------- | --------------------------------------------------------------------------- |
| 9   | **README trop court** (13 lignes)           | Première impression sur GitHub — manque install, usage, screenshots, badges |
| 10  | **Pas de CONTRIBUTING.md**                  | Important si open source                                                    |
| 11  | **Controller admin trop gros** (839 lignes) | Maintenabilité — splitter en sous-controllers                               |
| 12  | **Pas de 2FA/MFA**                          | Bonus sécurité                                                              |
| 13  | **ESLint 8** (legacy)                       | Migrer vers ESLint 9 flat config avant qu'ESLint 8 soit deprecated          |

## Plan d'action recommandé

```
Phase 1 — Tests & CI (crédibilité GitHub)
  ├── Ajouter Vitest + supertest
  ├── Tests unitaires : utils, helpers, services (mocks Sequelize)
  ├── Tests d'intégration : routes API + routes web
  ├── GitHub Actions : lint → test → build Docker
  └── Badge de couverture dans README

Phase 2 — Production readiness
  ├── Migrations Sequelize (remplacer sync())
  ├── Corriger crypto (IV aléatoire)
  ├── Enrichir README (install, usage, screenshots, badges)
  ├── Version 1.0.0
  └── .env.example → documentation complète

Phase 3 — Fonctionnalités manquantes
  ├── Reset mot de passe (nodemailer déjà dispo)
  ├── Documentation API Swagger
  ├── Validation input Zod/Joi
  └── CONTRIBUTING.md + templates issues/PR
```
