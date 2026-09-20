---
name: javascript-clean-code
version: 1.0.0
description: Production-oriented Clean Code guidance for JavaScript and TypeScript agents.
triggers:
  - create JavaScript or TypeScript code
  - modify JavaScript or TypeScript code
  - refactor JavaScript or TypeScript
  - debug JavaScript or TypeScript
  - write or modify tests for JavaScript or TypeScript
  - review JavaScript or TypeScript
  - design JavaScript or TypeScript architecture
---

# JavaScript / TypeScript Clean Code Skill

## Mission

Produce JavaScript/TypeScript that is correct, secure, readable, maintainable, testable, cohesive, loosely coupled, explicit, and safe to evolve.

This skill is inspired by the principles of Robert C. Martin's *Clean Code*, adapted pragmatically for modern JavaScript/TypeScript. It does not reproduce the book.

## Core philosophy

1. Clarity over cleverness.
2. Simplicity over speculative abstraction.
3. Explicit dependencies over hidden dependencies.
4. Cohesion over fragmentation.
5. Loose coupling over accidental coupling.
6. Behavior-focused tests over implementation-focused tests.
7. Measured optimization over premature optimization.
8. Existing project conventions over invented conventions.

## Rule strength

- **MUST**: default requirement unless project constraints make it impossible.
- **SHOULD**: strong recommendation; deviate only with a reason.
- **MAY**: optional technique when it improves clarity.

## Priority order

When principles conflict, prioritize:

1. Correctness
2. Security and data integrity
3. Explicit user requirements
4. Existing project architecture and conventions
5. Domain clarity
6. Maintainability
7. Testability
8. Simplicity
9. Extensibility
10. Performance, when measured or materially relevant

## Activation

Apply this skill when the task creates, modifies, refactors, tests, reviews, debugs, or designs JavaScript/TypeScript.

Do not force a full refactor for documentation-only, lockfile-only, formatting-only, or unrelated configuration changes.

## Context loading

Load only the rule files relevant to the task:

| Task | Rules |
|---|---|
| Naming / readability | naming, variables, functions, comments, formatting |
| Business logic | functions, control-flow, objects-and-data-structures |
| Classes / OOP | classes, solid, dependencies |
| Async / API calls | async, side-effects, error-handling |
| Tests | testing |
| Security-sensitive code | security, error-handling |
| Architecture | architecture, dependencies, module-boundaries |
| Node.js | node-runtime, async, error-handling |
| TypeScript | typescript, naming, variables |
| Database / persistence | database, error-handling, resilience |
| Production operations | observability, configuration, resilience |
| Performance | performance, async, database |

## Existing codebase first

Before introducing a new pattern, inspect nearby code and follow established conventions unless they are clearly harmful.

Do not introduce a framework, dependency, abstraction layer, architecture style, or design pattern merely because it is theoretically cleaner.

## AI decision protocol

Before writing non-trivial code, answer internally:

1. What behavior is required?
2. What is the smallest coherent responsibility?
3. What data enters and leaves the unit?
4. Which dependencies are required?
5. Which operations have side effects?
6. What can fail?
7. What invalid states are possible?
8. How will the behavior be tested?
9. What existing project conventions apply?
10. What is the simplest design that satisfies the requirement?

Do not expose hidden chain-of-thought. Output only concise conclusions when explanation is useful.

## Abstraction gate

Before creating a class, interface, repository, service, factory, strategy, adapter, manager, helper, utility, dependency-injection layer, event bus, CQRS layer, or similar abstraction, verify:

- There is a concrete responsibility.
- The abstraction has a clear owner.
- It removes meaningful duplication or coupling.
- It improves testability or change isolation.
- It does not merely wrap one function.
- It is justified by current requirements, not hypothetical future requirements.

If not, prefer simpler code.

## Function gate

For each non-trivial function:

- Give it one cohesive responsibility.
- Keep one abstraction level where practical.
- Prefer few parameters.
- Avoid boolean flags that change behavior; use separate functions or a descriptive options object.
- Keep side effects explicit.
- Separate command and query behavior when practical.
- Name the function after its observable intent.

## Module gate

A module SHOULD have a clear reason to change.

Avoid:

- god modules
- circular dependencies
- generic utility dumping grounds
- hidden global state
- modules that mix transport, domain, persistence, and presentation concerns without a reason

## Dependency gate

Dependencies MUST be explicit.

Avoid hidden globals, accidental singletons, and imports whose purpose is unclear.

Use dependency injection only when it meaningfully improves isolation, testing, or composition.

Keep wiring near a composition root.

## Testing gate

For changed behavior:

- Prefer tests that describe observable behavior.
- Cover success and meaningful failure paths.
- Mock external boundaries rather than internal implementation details.
- Keep tests deterministic.
- Do not chase coverage numbers at the expense of useful tests.

## AI self-review protocol

Before considering a task complete, perform this checklist internally:

### 1. Correctness
- Does the implementation satisfy the requirement?
- Are edge cases handled?
- Are async and error paths correct?

### 2. Design
- Does each unit have a clear responsibility?
- Are dependencies explicit?
- Did I add an unnecessary abstraction?

### 3. Readability
- Do names reveal intent?
- Is control flow easy to follow?
- Could a competent developer understand it quickly?

### 4. Testability
- Can important behavior be tested without fragile mocks?
- Are external boundaries isolated?

### 5. Error handling
- Are errors swallowed?
- Is useful context preserved?
- Are expected and unexpected failures distinguished?

### 6. Security
- Is untrusted input validated?
- Are secrets protected?
- Are authorization and injection risks considered where relevant?

### 7. Complexity
- Is nesting reasonable?
- Is there accidental duplication?
- Did the change introduce unnecessary indirection?

### 8. Consistency
- Does the code fit the repository?
- Did I preserve existing APIs and conventions unless change was required?

Classify internally as:
- **CLEAN**
- **ACCEPTABLE**
- **NEEDS_REFACTOR**

Do not expose internal reasoning. If the result is NEEDS_REFACTOR, improve the implementation before finalizing.

## Definition of Done

A JavaScript/TypeScript change is done when:

- behavior is correct
- names communicate intent
- responsibilities are cohesive
- dependencies are explicit
- side effects are controlled
- failure behavior is deliberate
- security implications are addressed
- tests cover important behavior
- complexity is justified
- project conventions are respected
- no speculative abstraction was introduced
