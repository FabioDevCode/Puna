# Plan — Script `setup.js`

Script Node.js interactif à la racine du projet pour générer le fichier `.env`.
Utilise **uniquement des modules natifs Node.js** (`readline`, `crypto`, `fs`) — aucune dépendance npm requise.

---

## Pourquoi Node natif ?

- Aucun `npm install` nécessaire avant d'exécuter le script
- Fonctionne sous Linux, macOS et Windows
- Cohérent avec le projet (déjà en Node.js)

---

## Ordre des sections

1. **App** — `NODE_ENV`, `PORT`
2. **Base de données** — `DB_IP`, `DB_PORT`, `DB_USER`, `DB_PWD`, `DB_NAME`, `DB_DIALECT`
3. **Sécurité** — `KEY_TK`, `KEV`, `KIV`, `SESSION_SECRET`, `SESSION_MAX_AGE`, `CSRF_SECRET`, `API_KEY` → générées automatiquement
4. **Logs** — `LOG_LEVEL`, `LOG_ROTATION_MAX_SIZE`, `LOG_ROTATION_MAX_FILES`
5. **Rate Limiting** — `LOGIN_WINDOW_MS`, `LOGIN_MAX_ATTEMPTS`, `MAX_FAILED_LOGIN_ATTEMPTS`
6. **Upload** — `API_MAX_FILE_SIZE`, `API_MAX_TOTAL_SIZE`, `API_MAX_FILES`, `API_MAX_FIELDS`, `API_MAX_FIELD_SIZE`
7. **ClamAV** _(optionnel)_ — demande confirmation, skippe si non
8. **SMTP** _(optionnel)_ — demande confirmation, skippe si non
9. **APP_URL** — utilisée pour les liens dans les emails

---

## Comportement prévu

### Valeurs par défaut

Chaque variable affiche sa valeur par défaut entre crochets.
L'utilisateur peut appuyer sur **Entrée** pour l'accepter sans retaper.

```
? PORT [3022] :
```

### Clés de sécurité (section 3)

Générées automatiquement via `crypto.randomBytes()`, sans interaction.
Elles sont affichées à titre informatif dans le terminal.

```
✔ Clés de sécurité générées automatiquement.
```

### Sections optionnelles (ClamAV, SMTP)

```
? Activer ClamAV (scan antivirus) ? (o/N) : N
  → Section ignorée, variables non écrites dans le .env
```

### Si `.env` existe déjà

- Avertissement affiché
- Demande de confirmation avant d'écraser
- Création automatique d'un `.env.backup` avant écrasement

```
⚠ Un fichier .env existe déjà.
? Écraser et créer un .env.backup ? (o/N) :
```

---

## Langue

Questions posées en **anglais** (projet open source public).

---

## Intégration Makefile (à créer en même temps)

```makefile
setup:
    @node setup.js

install: setup
    npm install

start:
    docker compose up -d

dev:
    npm run dev
```

---

## À faire

- [ ] Écrire `setup.js` (modules natifs uniquement)
- [ ] Écrire `Makefile`
- [ ] Vérifier que toutes les variables de `.env.example` sont couvertes
