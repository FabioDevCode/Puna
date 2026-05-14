---
name: commit-format
description: 'Write a well-formed git commit message following Conventional Commits. Use when committing changes, reviewing a commit message, choosing a commit type or scope, or formatting a multi-line commit. Trigger words: commit, git commit, conventional commits, commit message, staging, changelog.'
argument-hint: "Optional: brief description of the change (e.g. 'fix login redirect')"
---

# Commit Format

Guides the agent to write a correct, project-compliant git commit message following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## When to Use

- Committing staged or unstaged changes
- Reviewing or rewriting an existing commit message
- Choosing the right type and scope for a change
- Generating a multi-line commit with body and footer

## Format

```
<type>(<scope>): <description>

[optional body — explain WHY, not HOW]

[optional footer — BREAKING CHANGE, Closes #n, Refs #n]
```

**First line max: 72 characters. Always in English. Imperative mood. No trailing period.**

## Step-by-Step Procedure

1. **Identify the type** — pick from the table below based on the nature of the change
2. **Choose a scope** — use a scope from the project scope list; omit only if truly cross-cutting
3. **Write the description** — one concise imperative phrase, lowercase, no period, ≤ 72 chars total
4. **Add a body** (optional) — blank line after the description, explain the context and motivation
5. **Add a footer** (optional) — `Closes #n`, `Refs #n`, or `BREAKING CHANGE: <explanation>`

## Types

| Type       | Use when…                                      |
| ---------- | ---------------------------------------------- |
| `feat`     | Adding a new feature or capability             |
| `fix`      | Correcting a bug or broken behavior            |
| `docs`     | Documentation only (no code change)            |
| `style`    | Formatting, indentation, whitespace (no logic) |
| `refactor` | Restructuring code without changing behavior   |
| `perf`     | Improving performance                          |
| `test`     | Adding or updating tests                       |
| `build`    | Build system, scripts, or dependency changes   |
| `ci`       | CI/CD pipeline or configuration changes        |
| `chore`    | Maintenance tasks not fitting other types      |
| `revert`   | Reverting a previous commit                    |

## Project Scopes

| Area     | Scopes                                                                     |
| -------- | -------------------------------------------------------------------------- |
| Backend  | `auth`, `api`, `controllers`, `models`, `middlewares`, `helpers`, `config` |
| Frontend | `views`, `layouts`, `components`, `styles`, `js`                           |
| Features | `inbox`, `forms`, `sites`, `admin`, `dashboard`, `export`                  |
| Infra    | `db`, `docker`, `deps`                                                     |

## Writing Rules

- **Imperative mood**: "add" — not "added" / "adds"
- **Lowercase** after the type/scope colon
- **No trailing period** on the first line
- **72-character limit** on the first line
- **English only**
- **One logical change per commit** — do not mix unrelated modifications

## Examples

### Simple feature

```
feat(inbox): add bulk delete action
```

### Bug fix with context

```
fix(auth): prevent session fixation on logout

Session IDs were reused after logout, enabling session fixation.
Now regenerated on login and fully destroyed on logout.

Closes #234
```

### Refactoring

```
refactor(controllers): replace ownership checks with getSiteWhereCondition

Centralises access logic to support viewer/editor roles.
Affects site, form, inbox, and export controllers.
```

### Breaking change

```
feat(api): change inbox response format

BREAKING CHANGE: Inbox API now returns {items, total} instead of a flat array.
Update all client-side consumers accordingly.

Closes #456
```

### Dependencies

```
build(deps): update sequelize to v6.37.7
```

### Multiple changes in one commit

```
feat(rbac): implement role-based access control

- Add permissions.js with role definitions
- Create actionAccess and roleAccess middlewares
- Update all controllers with access checks
- Add Handlebars helpers for UI permission checks

Closes #100, #101, #102
```

## Anti-patterns

```
# ❌ Wrong
Added new feature.
Fix bug
updated the readme file
feat: J'ai ajouté l'authentification

# ✅ Correct
feat(auth): add two-factor authentication
fix(inbox): resolve file upload validation error
docs(readme): update installation steps
```
