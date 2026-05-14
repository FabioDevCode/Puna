---
description: 'Use when writing git commit messages, staging changes, or reviewing commits. Covers Conventional Commits format, types, scopes, and project-specific examples.'
---

# Commit Message Format

This project follows the **Conventional Commits** specification.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

| Type       | When to use                               |
| ---------- | ----------------------------------------- |
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation only                        |
| `style`    | Formatting, indentation (no logic change) |
| `refactor` | Code change with no functional impact     |
| `perf`     | Performance improvement                   |
| `test`     | Adding or updating tests                  |
| `build`    | Build system or dependency changes        |
| `ci`       | CI/CD configuration changes               |
| `chore`    | Maintenance tasks                         |
| `revert`   | Reverting a previous commit               |

## Scopes

**Backend**: `auth`, `api`, `controllers`, `models`, `middlewares`, `helpers`, `config`
**Frontend**: `views`, `layouts`, `components`, `styles`, `js`
**Features**: `inbox`, `forms`, `sites`, `admin`, `dashboard`, `export`
**Infra**: `db`, `docker`, `deps`

## Rules

1. **Imperative mood**: "add" not "added" or "adds"
2. **Lowercase** after the type
3. **No period** at the end of the description
4. **Max 72 characters** for the first line
5. **Always in English**

## Examples

```
feat(auth): add two-factor authentication
fix(inbox): resolve file upload validation error
refactor(controllers): simplify site access logic
test(auth): add login validation tests
build(deps): update sequelize to v6.37.7
docs(api): update endpoint documentation
```

### With body and footer

```
fix(auth): prevent session fixation on logout

Session IDs were reused after logout, enabling session fixation attacks.
Now regenerated on login and fully destroyed on logout.

Closes #123
```

### Breaking change

```
feat(api): change inbox response format

BREAKING CHANGE: Inbox API now returns {items, total} instead of a flat array.

Closes #456
```

## Atomic Commits

Each commit must represent **one logical change**. Avoid mixing unrelated modifications.
