# Testing Rules

- Test observable behavior and important business rules.
- Prefer deterministic tests.
- Cover meaningful success, edge, and failure paths.
- Mock external boundaries, not every internal function.
- Avoid tests coupled to private implementation details.
- Use unit tests for focused logic and integration tests for real boundaries where valuable.
- Use end-to-end tests for critical user/system journeys when justified.
- Treat coverage as a signal, not the goal.
- Test concurrency, retries, idempotency, and failure behavior when they are part of the contract.
