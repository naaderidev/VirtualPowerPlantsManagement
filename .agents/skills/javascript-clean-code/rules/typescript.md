# TypeScript Rules

- Prefer strict compiler settings for new code.
- Model domain states with useful types.
- Avoid `any` and unnecessary type assertions.
- Prefer discriminated unions for finite state machines and variants.
- Use `unknown` at unsafe boundaries and narrow it.
- Keep public types intentional and stable.
- Do not create interfaces for every object by default.
- Prefer type aliases for simple composition; use interfaces when their extension/implementation semantics are useful.
- Avoid overly clever type-level programming when runtime behavior becomes harder to understand.
