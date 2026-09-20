# Observability Rules

- Log meaningful events, not every line of code.
- Prefer structured logs.
- Include correlation/request identifiers when available.
- Never log secrets or sensitive data unnecessarily.
- Use metrics for measurable system behavior.
- Use traces where distributed request flow matters.
- Errors SHOULD preserve enough context to diagnose failures without exposing sensitive information.
