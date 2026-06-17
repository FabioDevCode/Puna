<p align="center">
  <img src="src/public/img/puna.svg" alt="Puna Logo" width="200" />
</p>

<h1 align="center">Puna</h1>

<p align="center">
  Centralisez tous les formulaires de vos sites web au même endroit via une API unique et simple,<br> pour une gestion simplifiée de vos données.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/licence-AGPLv3-red.svg?style=flat" alt="Licence AGPLv3" />
  <img src="https://img.shields.io/badge/docker-fabiodevcode/puna-blue.svg?style=flat" alt="docker fabiodevcode/puna" />
  <img src="https://img.shields.io/badge/coverage-75.99%25-2C7C3E.svg?style=flat" alt="Coverage 75.99%" />
</p>

---

## Présentation

**Puna** est un panel d'administration auto-hébergé pour centraliser tous vos formulaires au même endroit. Branchez vos formulaires existants sur Puna via une API. Les soumissions arrivent directement dans l'application, sans avoir à définir de nouvelle base de données, gérer les champs ou maintenir les types de données vous-même.

---

## Fonctionnalités

- **Sites & Formulaires** - Structurez vos intégrations en créant des objets **_Site_** et **_Formulaire_** associés. Ces entités applicatives permettent de regrouper et d'identifier les soumissions par _site_ et _formulaire_.
- **API publique** - Un seul endpoint `POST /api/v1/send/:code` avec authentification 3 couches (clé API, JWT du _site_, code du _formulaire_). Prend en charge `JSON` & `Multipart Form`.
- **Soumissions** - Chaque appel à l'API crée une entrée consultable, filtrable et exportable (**Excel**/**CSV**). L'historique complet des données reçues est accessible depuis l'interface de chaque **_site_** et onglet de **_formulaire_**.
- **Authentification** - Login local, sessions persistantes, 2FA TOTP optionnel et réinitialisation par email.
- **RBAC** - 5 rôles (`super_admin`, `owner`, `unique`, `editor`, `viewer`) avec une matrice de permissions granulaire.
- **Admin & monitoring** - Gestion des utilisateurs, visualiseur de logs, tableau de bord et antivirus ClamAV optionnel sur chaque upload.
- **Serveur MCP** - Exposez vos données à des agents IA (Claude, ChatGPT, Cursor…) via un serveur Model Context Protocol intégré (`POST /mcp`). Chaque utilisateur gère ses propres clés d'accès. Les outils disponibles couvrent sites, formulaires, soumissions (liste, détail, recherche full-text, dernières entrées) et statistiques. Activable via la variable d'environnement `MCP_ENABLED`.

---

## Démarrage rapide

### Prérequis

| Outil   | Version | Obligatoire |
| ------- | ------- | ----------- |
| Node.js | ≥ 24    | Oui         |
| npm     | ≥ 10    | Oui         |
| MariaDB | ≥ 11    | Oui         |

**Optionnels :**

- **SMTP** - nécessaire pour la réinitialisation de mot de passe et email de bienvenue lors de la création d'un user. Sans configuration SMTP, la fonctionnalité est simplement désactivée.
- **ClamAV** - antivirus pour scanner les fichiers uploadés. Doit être installé et démarré avant le serveur si `CLAMAV_ENABLED=true`. accessible via socket

### Installation (Développeur)

```bash
git clone https://github.com/FabioDevCode/Puna.git
cd Puna
npm run setup  # génère le fichier .env de manière interactive
npm install
npm run dev
```

Une installation Docker et la référence complète de configuration sont disponibles dans la **documentation**.

---

## Technologies

<p align="left">
  <img src="https://img.shields.io/badge/Node.JS-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express" />
  <img src="https://img.shields.io/badge/Sequelize-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white" alt="Sequelize" />
  <img src="https://img.shields.io/badge/MariaDB-1F305F?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB" />
  <br>
  <img src="https://img.shields.io/badge/handlebars-F0772B?style=for-the-badge&logo=handlebarsdotjs&logoColor=483a2d" alt="Handlebars" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-030712?style=for-the-badge&logo=tailwindcss&logoColor=00BCFF" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/daisyUI-2A303C?style=for-the-badge&logo=daisyui&logoColor=FFD028" alt="daisyUI" />
</p>

---

## Sécurité

Puna applique une approche **défense en profondeur** alignée sur l'OWASP Top 10 : en-têtes Helmet, protection CSRF, bcrypt, JWT + AES-CBC, sanitisation XSS, rate limiting, scan ClamAV et requêtes préparées via Sequelize.

Pour le détail complet, voir [SECURITY.md](SECURITY.md).

---

## Tests

| Outil      | Type               | Configuration          |
| ---------- | ------------------ | ---------------------- |
| Vitest     | Unit / Integration | `vitest.config.js`     |
| Playwright | End-to-end         | `playwright.config.js` |

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions et commandes.

---

## Contribution

Les contributions sont les bienvenues !<br>
Consultez le guide complet dans [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3 (AGPLv3)**. Voir [License.md](License.md).
