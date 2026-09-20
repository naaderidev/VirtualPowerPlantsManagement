# Resilience Rules

For external or distributed systems:

- Define timeouts.
- Bound retries.
- Use exponential backoff with jitter where appropriate.
- Retry only operations that are safe to retry.
- Design idempotency for duplicate delivery/request scenarios.
- Handle partial failure explicitly.
- Consider rate limits and backpressure.
- Use circuit breakers only when failure isolation materially benefits the system.
- Do not add resilience machinery without a concrete failure mode.
