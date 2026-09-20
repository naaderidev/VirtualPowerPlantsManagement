# Async Rules

- Prefer `async`/`await` for sequential workflows.
- Use `Promise.all` for independent operations when concurrent execution is safe.
- Do not parallelize operations with ordering, rate-limit, consistency, or resource constraints.
- Handle rejection paths deliberately.
- External calls SHOULD have appropriate timeouts.
- Retries SHOULD be bounded, use backoff, and respect idempotency.
- Consider race conditions, duplicate requests, cancellation, and partial failure.
- Make expensive or network behavior visible in naming and architecture.
