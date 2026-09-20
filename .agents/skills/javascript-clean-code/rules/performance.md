# Performance Rules

- Correctness and clarity come first.
- Do not optimize without a plausible bottleneck or measured evidence when practical.
- Consider algorithmic complexity, memory, network calls, serialization, database queries, and event-loop blocking.
- Watch for N+1 queries and accidental repeated I/O.
- Cache only with a clear invalidation/ownership strategy.
- Avoid allocations or micro-optimizations that make code substantially harder to understand unless measurement justifies them.
