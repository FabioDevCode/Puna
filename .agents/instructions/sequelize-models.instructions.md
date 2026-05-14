---
description: 'Use when creating, modifying, or reviewing Sequelize models in this project. Covers the 3-file model pattern (*.models.js + attributes JSON + relations JSON), all supported type strings, naming conventions, PK rules, and relation definitions.'
applyTo: 'src/models/**'
---

# Sequelize Model Architecture

This project uses a **declarative, JSON-driven** model system. Each model is split into **3 files** — no manual registration in `index.js` is needed (it auto-loads every `*.models.js`).

```
src/models/<name>.models.js                    ← model definition (boilerplate)
src/models/attributes/<name>.attributes.json   ← columns / fields
src/models/relations/<name>.relations.json     ← associations
```

---

## Naming Conventions

| Concept                          | Convention      | Example        |
| -------------------------------- | --------------- | -------------- |
| File prefix                      | `snake_case`    | `site_user`    |
| `tableName` in options           | `snake_case`    | `"site_user"`  |
| Model name in `sequelize.define` | `PascalCase`    | `"SiteUser"`   |
| Relation `target`                | `PascalCase`    | `"SiteUser"`   |
| Foreign key columns              | `fk_id_<table>` | `"fk_id_site"` |

---

## The `.models.js` File — Boilerplate

Every model file has the **same structure** — only names and paths differ:

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

---

## Attributes JSON — Type Reference

Types are **strings** in JSON, resolved by `buildAttributes()` in `helpers/models.helpers.js`:

| JSON `"type"` string | Resolves to                 | Notes                                              |
| -------------------- | --------------------------- | -------------------------------------------------- |
| `"STRING"`           | `DataTypes.STRING(255)`     | Default string                                     |
| `"STRING(100)"`      | `DataTypes.STRING(100)`     | Short string                                       |
| `"STRING(250)"`      | `DataTypes.STRING(250)`     | Medium string                                      |
| `"UUID"`             | `DataTypes.UUID`            | Auto-generates UUIDv7 unless `defaultValue` is set |
| `"INTEGER"`          | `DataTypes.INTEGER`         |                                                    |
| `"BOOLEAN"`          | `DataTypes.BOOLEAN`         |                                                    |
| `"DATE"`             | `DataTypes.DATE`            | Datetime with timezone                             |
| `"DATEONLY"`         | `DataTypes.DATE`            | ⚠ Maps to DATE, not DATEONLY                       |
| `"TEXT"`             | `DataTypes.TEXT`            |                                                    |
| `"LONGTEXT"`         | `DataTypes.TEXT('long')`    |                                                    |
| `"ENUM"`             | `DataTypes.ENUM(...values)` | Requires `"values": [...]` array                   |

### Attribute object shape

```json
{
    "field_name": {
        "type": "STRING",
        "allowNull": false,
        "defaultValue": "active",
        "primaryKey": true,
        "unique": true,
        "autoIncrement": true
    }
}
```

All fields require `"type"` and `"allowNull"`. Other properties are optional.

### Primary key rules

- **Standard (UUID)**: `"type": "UUID"`, `"primaryKey": true`, `"unique": true` — UUIDv7 auto-generated
- **Junction table (INTEGER)**: `"type": "INTEGER"`, `"primaryKey": true`, `"autoIncrement": true`

### ENUM fields

Always include a `"values"` array:

```json
"status": {
    "allowNull": false,
    "defaultValue": "pending",
    "type": "ENUM",
    "values": ["pending", "active", "inactive"]
}
```

---

## Relations JSON — Structure

An array of association objects:

```json
[
    {
        "relation": "belongsTo",
        "target": "User",
        "foreignKey": "fk_id_user",
        "as": "user"
    }
]
```

Supported `"relation"` values: `"belongsTo"` | `"hasMany"` | `"hasOne"` | `"belongsToMany"`

The builder forces `foreignKey` and `as` to lowercase — write them lowercase in JSON.

### `belongsToMany` extra fields

```json
{
    "relation": "belongsToMany",
    "target": "User",
    "foreignKey": "fk_id_site",
    "otherKey": "fk_id_user",
    "through": "SiteUser",
    "as": "users"
}
```

### When to declare FK columns in `attributes.json`

- **Junction tables** (e.g. `site_user`): always declare FK columns explicitly
- **Regular tables**: Sequelize auto-manages FK columns via relations — only declare them if you need to query the FK value directly

---

## Existing Models

| Model      | Table       | File prefix |
| ---------- | ----------- | ----------- |
| `User`     | `user`      | `user`      |
| `Site`     | `site`      | `site`      |
| `Form`     | `form`      | `form`      |
| `Inbox`    | `inbox`     | `inbox`     |
| `SiteUser` | `site_user` | `site_user` |
| `Mcp_keys` | `mcp_keys`  | `mcp_keys`  |
