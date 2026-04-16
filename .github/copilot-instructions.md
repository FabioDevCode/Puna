# Copilot Instructions — Puna

Puna is a **feedback form management application** (AGPLv3). It lets users create sites, attach HTML forms to them, collect submissions ("inbox"), and export data. The stack is Node.js (ESM), Express 5, Sequelize (MySQL/MariaDB), Handlebars views, and a public REST API.

## Architecture

Two distinct surfaces share the same Express app:

| Surface    | Prefix      | Auth                             | CSRF              |
| ---------- | ----------- | -------------------------------- | ----------------- |
| Web (SSR)  | `/`         | Session + Passport               | Yes (`csrf-csrf`) |
| Public API | `/api/v1/…` | `X-KEY-PUNA` + Bearer JWT (site) | No (CORS enabled) |

Middleware order in [`src/app.js`](src/app.js) is strict: `helmet → cors(/api) → session → passport → flash → injectUserRole → csrfProtection`.

## Auto-Loading Conventions

- **Web routes**: every `src/routes/*.routes.js` is mounted automatically. `default.routes.js` → `/`, `foo.routes.js` → `/foo`.
- **API routes**: every `src/api/v1/*.api.js` is mounted at `/api/v1/<name>`. `default.api.js` → `/api/v1`.
- **Models**: every `src/models/*.models.js` is loaded by `src/models/index.js` and associated. Adding a new model only requires creating the file + its JSON descriptors.

## Model Pattern

Models are **declarative JSON + a builder**, not hand-coded Sequelize classes:

```
src/models/attributes/form.attributes.json  ← column definitions
src/models/relations/form.relations.json    ← associations
src/models/form.models.js                   ← calls builder.buildAttributes() / buildRelations()
src/helpers/models.helpers.js                  ← the builder (maps string types to DataTypes)
```

Never write `DataTypes.STRING` directly in a model file — add the column to the `.attributes.json` instead.

## Public API Authentication (3-layer)

The single API endpoint is `POST /api/v1/send/:code` ([`src/api/v1/default.api.js`](src/api/v1/default.api.js)). Every request passes through [`authApiKeyAccess`](src/api/v1/middlewares/authApiKeyAccess.js) which enforces **three checks in order**:

1. **`X-KEY-PUNA` header** — global API key (env `API_KEY`), compared with `crypto.timingSafeEqual` to prevent timing attacks.
2. **`Authorization: Bearer <token>`** — a JWT signed with `KEY_TK`, whose payload contains a `Site.id` and a `Site.control_code` (an encrypted object). The site row is looked up and must match both fields.
3. **`:code` URL param** — matches a `Form.code` whose `fk_id_site` equals the authenticated site id.

On success, `req.site` and `req.form` are injected for all downstream middlewares. The token (JWT wrapping the encrypted `{id, control_code}`) is generated in the web app and exposed via `/site/:id/token`.

**Upload pipeline** (executed after auth in order):
`multipartUpload → validateUpload → inspectArchive → scanUpload → moveFilesToUploads → updateFormFileKeys → sanitizeRequestBody → updateFormTemplate → sendHandler`

The final step (`sendHandler`) saves the sanitized payload as `JSON.stringify(req.sanitizedBody)` into `Inbox.content`.

## RBAC / Permissions

Roles: `super_admin`, `owner`, `beta`, `editor`, `viewer`.

- Permission matrix: [`src/config/permissions.js`](src/config/permissions.js)
- Route enforcement: `actionAccess('entity', 'action')` or `roleAccess(['role'])` from [`src/middlewares/checkAccess.js`](src/middlewares/checkAccess.js)
- Data scoping (Sequelize `WHERE`): [`src/services/access.service.js`](src/services/access.service.js) → `getSiteWhereCondition(userId, userRole)`

Always call `getSiteWhereCondition` in service functions that list resources, never hardcode WHERE clauses for access control.

**Admin panel** (`/admin/*`, controllers in `src/controllers/admin/`): accessible to `super_admin` and `owner`, **except** user deletion and logs viewer which are restricted to `super_admin` only.

## Controller → Service Pattern

Controllers (`src/controllers/`) handle HTTP: read `req`, call services, call `res.flash()` + `res.redirect()` or `res.render()`. Services (`src/services/`) contain all business logic and Sequelize queries; they return plain JS objects (`model.toJSON()`), never raw Sequelize instances.

Controllers read the user role from `req.userRole || req.session.user?.role`.

## Feature Flags (env)

- `TOTP_ENABLED=true` — activates 2FA TOTP globally (checked via `isTotpEnabled()` in [`src/config/env.validator.js`](src/config/env.validator.js))
- Mail features (password reset, etc.) are silently disabled if any SMTP var is missing (`SMTP_HOST/PORT/USER/PASS/FROM`)
- `mailEnabled` is injected into every HBS template via `res.locals`

## Environment Validation (`env.validator.js`)

[`src/config/env.validator.js`](src/config/env.validator.js) runs at startup (called from `server.js`) and blocks the process if the configuration is invalid. It performs:

1. **Required vars** — hard fail if any of `DB_*`, `KEY_TK`, `KEV`, `KIV`, `SESSION_SECRET`, `CSRF_SECRET`, `API_KEY`, `PORT`, `NODE_ENV` is missing.
2. **Format checks** — port ranges, `NODE_ENV` and `DB_DIALECT` allowed values, hex length for `KEV` (64 chars / 32 bytes) and `KIV` (32 chars / 16 bytes).
3. **Security warnings** — keys shorter than 32 chars or still using example values trigger `⚠️` warnings (non-blocking).
4. **SMTP** — if some but not all `SMTP_*` vars are set, a warning is printed and the mail feature is silently disabled (never a hard error).
5. **ClamAV connectivity** — if `CLAMAV_ENABLED=true`, a live `PING/PONG` is performed before the server starts (fails hard if unreachable).

Two exported helpers are used throughout the app: `isTotpEnabled()` and `isMailConfigured()`.

## ClamAV (optional antivirus)

Controlled by `CLAMAV_ENABLED=true/false`. When enabled, the [`scanUpload`](src/api/v1/middlewares/scanUpload.js) middleware scans every uploaded file before it is moved to permanent storage.

Two connection modes (mutually exclusive):

| Mode        | Config                                    | Typical use                          |
| ----------- | ----------------------------------------- | ------------------------------------ |
| Unix socket | `CLAMAV_SOCKET=/tmp/clamd.socket`         | macOS Homebrew / native Linux        |
| TCP         | `CLAMAV_HOST=clamav` + `CLAMAV_PORT=3310` | Docker (leave `CLAMAV_SOCKET` empty) |

At startup, `env.validator.js` pings the daemon (`PING → PONG`) and exits with an error if it is unreachable. Set `CLAMAV_ENABLED=false` to bypass entirely.

## Developer Workflows

```bash
npm run dev          # node --watch (no nodemon needed), loads .env automatically
npm test             # vitest run (single pass)
npm run test:watch   # vitest interactive
npm run format       # prettier on JS/JSON + custom HBS formatter (scripts/format-hbs.js)
npm run lint:fix     # eslint --fix
npm run logs:rotate  # manual log rotation (cron also configured in src/config/cron.js)
```

No build step. Files are served directly as ESM (`"type": "module"`). Use `node --env-file=.env` pattern — no `dotenv` package.

## Testing Conventions

Tests use **Vitest** with `globals: true`. Always mock these three modules in unit tests:

```js
vi.mock('../../../src/config/logger.js', () => ({ logger: { info: vi.fn(), … }, … }));
vi.mock('../../../src/models/index.js', () => ({ default: { ModelName: { findByPk: vi.fn() } } }));
vi.mock('../../../src/utils/crypto.js', () => ({ encryptString: vi.fn(s => `enc:${s}`), … }));
```

See [`tests/unit/services/twoFactor.service.test.js`](tests/unit/services/twoFactor.service.test.js) as the reference example for service unit tests.

## File Storage

Uploaded files go to `storage/uploads/<domain>/` (one folder per site domain). Temporary files use `storage/tmp/`. Paths are resolved relative to project root in [`src/services/form.service.js`](src/services/form.service.js).

## Localisation

Single locale (`fr`). All user-facing strings go in [`src/locales/fr.json`](src/locales/fr.json) using dot-notation object paths.
