# Naming Rules

## MUST
- Names MUST reveal intent.
- Functions SHOULD use verbs; classes/types SHOULD use domain nouns.
- Boolean names SHOULD read like predicates: `isActive`, `hasAccess`, `canPublish`.
- Use one consistent word per concept.
- Prefer searchable names over single-letter or cryptic abbreviations.
- Include meaningful units where ambiguity exists: `timeoutMs`, `distanceKm`, `retryCount`.

## SHOULD
- Prefer domain vocabulary over generic terms such as `data`, `info`, `thing`, `item`, `manager`, `helper`.
- Avoid names that differ only by subtle spelling.
- Avoid misleading names and redundant type information.

## Example

Bad:
```ts
function getData(d) {}
```

Good:
```ts
function findActiveUsers(users) {}
```
