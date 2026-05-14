---
name: sequelize-models
description: 'Create or modify a Sequelize model in this project. Use when adding a new model, adding a column, changing a field type, adding a relation, or reviewing model structure. Covers the 3-file pattern (*.models.js + attributes JSON + relations JSON), all supported types, naming conventions, and foreign key rules. Trigger words: sequelize, model, create model, add column, add relation, attributes, foreign key, migration.'
argument-hint: "Optional: model name to create or modify (e.g. 'order_item')"
---

# Sequelize Models

Guides the agent to correctly create or modify a Sequelize model using this project's custom **3-file, JSON-driven** architecture.

## When to Use

- Creating a new model from scratch
- Adding or renaming a column
- Changing a field type or constraint
- Adding a new relation (belongsTo, hasMany, etc.)
- Reviewing an existing model's structure

## Architecture Overview

Each model is composed of exactly 3 files:

```
src/models/<name>.models.js                    ← model loader (boilerplate, never changes)
src/models/attributes/<name>.attributes.json   ← columns and field definitions
src/models/relations/<name>.relations.json     ← associations with other models
```

`src/models/index.js` auto-discovers and loads every `*.models.js` — **never register a model manually**.

---

## Step-by-Step: Creating a New Model

### Step 1 — Choose the naming base

Determine the `snake_case` name for the model (matches the DB table name).

| Concept                  | Convention      | Example for `order_item` |
| ------------------------ | --------------- | ------------------------ |
| File prefix              | `snake_case`    | `order_item`             |
| `tableName`              | `snake_case`    | `"order_item"`           |
| Model name in `define()` | `PascalCase`    | `"OrderItem"`            |
| `target` in relations    | `PascalCase`    | `"OrderItem"`            |
| Foreign key columns      | `fk_id_<table>` | `"fk_id_order"`          |

### Step 2 — Create `<name>.models.js`

Copy this boilerplate exactly, substituting the name:

```js
import { createRequire } from 'node:module';
import * as builder from '../helpers/models.helpers.js';

const attributes = createRequire(import.meta.url)('./attributes/<name>.attributes.json');
const relations = createRequire(import.meta.url)('./relations/<name>.relations.json');

export default function (sequelize) {
    const attributes_build = builder.buildAttributes(attributes);
    const options = {
        sequelize,
        tableName: '<snake_case_table_name>',
        timestamps: true,
        indexes: builder.buildIndexes(attributes),
    };

    const Model = sequelize.define('<PascalCaseModelName>', attributes_build, options);
    Model.associate = builder.buildRelations('<PascalCaseModelName>', relations);

    return Model;
}
```

### Step 3 — Create `attributes/<name>.attributes.json`

Define every column as a JSON object. Keys are column names (`snake_case`).

**Every model must have an `id` primary key.** Use UUID (standard) or INTEGER (junction tables only).

#### Standard UUID primary key:

```json
"id": {
    "allowNull": false,
    "primaryKey": true,
    "type": "UUID",
    "unique": true
}
```

UUIDv7 is auto-generated — do not set `defaultValue` unless you want a fixed value.

#### INTEGER primary key (junction tables only):

```json
"id": {
    "allowNull": false,
    "autoIncrement": true,
    "primaryKey": true,
    "type": "INTEGER"
}
```

#### All available type strings:

| JSON `"type"`   | Resolved Sequelize type | Notes                                |
| --------------- | ----------------------- | ------------------------------------ |
| `"STRING"`      | `STRING(255)`           | General-purpose text                 |
| `"STRING(100)"` | `STRING(100)`           | Short text (login, code, name)       |
| `"STRING(250)"` | `STRING(250)`           | Medium text                          |
| `"UUID"`        | `UUID`                  | Auto UUIDv7 if no `defaultValue`     |
| `"INTEGER"`     | `INTEGER`               |                                      |
| `"BOOLEAN"`     | `BOOLEAN`               | Use `true`/`false` as `defaultValue` |
| `"DATE"`        | `DATE`                  | Datetime with timezone               |
| `"DATEONLY"`    | `DATE`                  | ⚠ Also maps to DATE — not DATEONLY   |
| `"TEXT"`        | `TEXT`                  | Long text                            |
| `"LONGTEXT"`    | `TEXT('long')`          | Very long text, JSON payloads        |
| `"ENUM"`        | `ENUM(...values)`       | Must include `"values": [...]`       |

#### Required properties per field:

| Property          | Required           | Notes                              |
| ----------------- | ------------------ | ---------------------------------- |
| `"type"`          | ✅                 | String from table above            |
| `"allowNull"`     | ✅                 | `true` or `false`                  |
| `"defaultValue"`  | optional           | Omit for UUID auto-generation      |
| `"primaryKey"`    | only on PK         | `true`                             |
| `"unique"`        | optional           | `true` if unique constraint needed |
| `"autoIncrement"` | only on INTEGER PK | `true`                             |
| `"values"`        | only for ENUM      | Array of allowed string values     |

#### Example — full attributes file:

```json
{
    "id": {
        "allowNull": false,
        "primaryKey": true,
        "type": "UUID",
        "unique": true
    },
    "name": {
        "allowNull": false,
        "type": "STRING(100)"
    },
    "status": {
        "allowNull": false,
        "defaultValue": "draft",
        "type": "ENUM",
        "values": ["draft", "published", "archived"]
    },
    "content": {
        "allowNull": true,
        "type": "LONGTEXT"
    },
    "is_active": {
        "allowNull": false,
        "defaultValue": true,
        "type": "BOOLEAN"
    }
}
```

### Step 4 — Create `relations/<name>.relations.json`

Define associations as a JSON array. Use `[]` if no relations.

```json
[
    {
        "relation": "belongsTo",
        "target": "User",
        "foreignKey": "fk_id_user",
        "as": "user"
    },
    {
        "relation": "hasMany",
        "target": "Inbox",
        "foreignKey": "fk_id_form",
        "as": "entries"
    }
]
```

#### Relation types:

| `"relation"`      | Meaning                      | FK lives in...      |
| ----------------- | ---------------------------- | ------------------- |
| `"belongsTo"`     | This table → other table     | This model's table  |
| `"hasMany"`       | This table ← many other rows | Other model's table |
| `"hasOne"`        | This table ← one other row   | Other model's table |
| `"belongsToMany"` | Many-to-many via junction    | Junction table      |

#### `belongsToMany` (requires extra fields):

```json
{
    "relation": "belongsToMany",
    "target": "User",
    "foreignKey": "fk_id_site",
    "otherKey": "fk_id_user",
    "through": "SiteUser",
    "as": "assignedusers"
}
```

#### Rules:

- `"target"` must be PascalCase and match the model name in `sequelize.define`
- `"foreignKey"` and `"as"` are forced to lowercase by the builder — write them lowercase
- All relations get `allowNull: true` automatically
- To disable FK constraints: add `"constraints": false`

#### FK columns in `attributes.json`:

- **Junction tables**: declare all FK columns explicitly (they are the table's main columns)
- **Regular tables with `belongsTo`**: the FK lives in this table but you do NOT need to declare it in attributes unless you query the raw FK value directly

### Step 5 — Update the inverse side (if needed)

If another model should reference this new model, add the inverse relation in that model's `relations.json`.

Example — if `User` should `hasMany OrderItem`:

Add to `src/models/relations/user.relations.json`:

```json
{
    "relation": "hasMany",
    "target": "OrderItem",
    "foreignKey": "fk_id_user",
    "as": "orderitems"
}
```

---

## Common Patterns from Existing Models

### Simple `belongsTo` (Form → Site)

```json
[{ "relation": "belongsTo", "target": "Site", "foreignKey": "fk_id_site", "as": "site" }]
```

### Self-referencing (`User` created by another `User`)

```json
[
    { "relation": "belongsTo", "target": "User", "foreignKey": "created_by", "as": "creator" },
    { "relation": "hasMany", "target": "User", "foreignKey": "created_by", "as": "createdusers" }
]
```

### Junction table (`SiteUser` with two `belongsTo`)

```json
[
    { "relation": "belongsTo", "target": "Site", "foreignKey": "fk_id_site", "as": "site" },
    { "relation": "belongsTo", "target": "User", "foreignKey": "fk_id_user", "as": "user" }
]
```

---

## Anti-patterns

```
❌ Registering the model manually in index.js — auto-loaded, never do this
❌ Using DataTypes.STRING directly in attributes JSON — use the string "STRING" instead
❌ Omitting "values" on an ENUM field — builder will throw
❌ Using uppercase for "as" or "foreignKey" — builder lowercases them, be consistent
❌ Setting defaultValue on a UUID PK — prevents UUIDv7 auto-generation
❌ Declaring FK columns in a regular (non-junction) table — let Sequelize manage them
```

---

## Existing Models Reference

| Model      | Table       | PK type               | Relations                                            |
| ---------- | ----------- | --------------------- | ---------------------------------------------------- |
| `User`     | `user`      | UUID                  | self-ref creator, hasMany SiteUser, hasMany Mcp_keys |
| `Site`     | `site`      | UUID                  | belongsTo User, hasMany SiteUser                     |
| `Form`     | `form`      | UUID                  | belongsTo Site                                       |
| `Inbox`    | `inbox`     | UUID                  | belongsTo Form                                       |
| `SiteUser` | `site_user` | INTEGER autoIncrement | belongsTo Site, belongsTo User                       |
| `Mcp_keys` | `mcp_keys`  | UUID                  | belongsTo User                                       |
