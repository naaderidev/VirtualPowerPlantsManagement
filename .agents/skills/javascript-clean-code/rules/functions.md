# Function Rules

- A function MUST have one cohesive responsibility.
- Keep abstraction levels consistent.
- Prefer small functions when splitting improves meaning; do not split mechanically.
- Prefer few arguments.
- Avoid boolean flags that change behavior.
- Use an options object when named configuration improves clarity.
- Keep side effects explicit.
- Prefer command/query separation where practical.
- Avoid functions whose names hide expensive I/O, mutation, or network access.

Bad:
```ts
registerUser(user, true, false, true);
```

Better:
```ts
registerUser(user, { sendWelcomeEmail: true, audit: true });
```
