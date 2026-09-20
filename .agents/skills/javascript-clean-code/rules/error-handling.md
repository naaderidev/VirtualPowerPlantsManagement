# Error Handling Rules

- Never silently swallow errors.
- Catch errors only when you can handle, translate, enrich, recover, or intentionally suppress them.
- Preserve useful context and original causes.
- Use meaningful error categories.
- Distinguish expected business failures from unexpected system failures.
- Do not leak secrets or sensitive data in errors/logs.
- Avoid catch-and-rethrow without added value.

Example:
```ts
throw new UserRegistrationError("Failed to register user", { cause: error });
```
