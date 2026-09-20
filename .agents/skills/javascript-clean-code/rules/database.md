# Database and Persistence Rules

- Keep persistence concerns behind clear boundaries when that improves change isolation.
- Use transactions for operations that must be atomic.
- Consider concurrency and isolation semantics.
- Avoid N+1 queries.
- Make query intent visible.
- Do not hide database I/O behind names that imply pure computation.
- Validate data at application boundaries and enforce important invariants in the database when appropriate.
- Design indexes from actual query patterns.
- Make migrations reversible or safely deployable where practical.
