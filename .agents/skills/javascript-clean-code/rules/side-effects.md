# Side Effect Rules

Side effects include network I/O, filesystem access, database writes, logging, timers, global mutation, and external service calls.

- Isolate side effects at clear boundaries.
- Keep pure decision logic separate from I/O where practical.
- Make mutation ownership explicit.
- Avoid hidden side effects in functions whose names imply calculation or lookup.
- Prefer dependency injection at external boundaries when it materially improves testing.
