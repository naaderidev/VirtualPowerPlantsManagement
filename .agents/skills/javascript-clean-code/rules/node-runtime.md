# Node.js Runtime Rules

- Avoid blocking the event loop with expensive synchronous work in request paths.
- Handle graceful shutdown for long-running services.
- Close database, HTTP, queue, and other resources deliberately.
- Treat process-level errors and signals intentionally.
- Use streams for genuinely large data rather than loading everything into memory.
- Keep environment and process concerns at application boundaries.
