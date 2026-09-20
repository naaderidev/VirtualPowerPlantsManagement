# Dependency Rules

- Dependencies MUST be explicit.
- Prefer constructor/function parameters or module imports over hidden global state.
- Avoid service locators and ambient mutable state.
- Keep dependency wiring near the composition root.
- Prevent circular dependencies.
- Inject boundaries that need isolation; do not inject every trivial value.
- Prefer stable, narrow interfaces between modules.
