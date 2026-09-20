# JavaScript / TypeScript Clean Code Agent Skill

Version: 1.0.0

A production-oriented skill for AI agents working on JavaScript and TypeScript.

It combines Clean Code principles with pragmatic modern JS/TS practices for:
- readable code
- cohesive responsibilities
- explicit dependencies
- testability
- safe async behavior
- deliberate error handling
- security
- maintainable architecture
- measured performance
- production resilience and observability

## Install

Copy this directory into:

```text
.agents/skills/javascript-clean-code/
```

The package is designed to be reusable across JavaScript/TypeScript repositories.

## Trigger behavior

Use the skill for:
- creating JS/TS
- modifying JS/TS
- refactoring
- debugging
- writing tests
- code review
- architecture decisions

Do not force it on documentation-only, lockfile-only, or unrelated formatting/configuration work.

## Design principle

Use the smallest design that makes the required behavior clear, testable, and safe to change.

## Contents

See `SKILL.md` for activation, decision gates, contextual loading, and the AI self-review protocol.

Rule files cover naming, functions, variables, control flow, comments, formatting, objects/data structures, classes, SOLID, dependencies, architecture, JavaScript, TypeScript, async, side effects, error handling, testing, security, performance, code smells, API design, database access, resilience, observability, configuration, and Node.js runtime concerns.

## Maintenance

- Update `VERSION` for releases.
- Keep `CHANGELOG.md` current.
- Prefer additive improvements over breaking trigger behavior.
- Validate examples whenever language/tooling conventions materially change.
