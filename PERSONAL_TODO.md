# SIMPLE TODO - Puna

## A implémenter

- [x] **Validation des entrées** coté app (Sanitization systématique)
- [x] **Rate limite** (login, API, exports)
- [ ] **CORS** - Configuration propre
- [ ] **Refonte JS front-end** - Architecture modulaire (core/components/pages)
- [ ] **errorHandler** - créer un handler d'error pour éviter les try/catch dans les controller
- [ ] **nodemailer** - ajout de nodemailer pour (mail de première connexion) + variable d'environnement pour l'envoi d'email (trovuer comment stocker les template d'email)
- [x] **Logs avec Pino** afficher les logs pino dans le panel d'administration
- [ ] **Utilisateurs** Amélioration de la gestion des utilisateurs, nombre d'essai de co, mot de passe oublié, etc
- [ ] **ClamAV** intégré CLamAV pour control de fichier avec variable d'environnement permettant de l'utiliser ou non.
- [ ] **Docker** créer un images docker de Puna.
- [ ] **compose** créer un docker compose afin de lancer l'app avec une BDD MariaDB
