# Before / After Refactoring

## Before

```ts
async function registerUser(input, db, mailer, logger) {
  if (!input.email || !input.password) {
    throw new Error("Invalid");
  }

  const existing = await db.users.findByEmail(input.email);
  if (existing) {
    throw new Error("Exists");
  }

  const user = await db.users.insert({
    email: input.email,
    passwordHash: await hash(input.password),
  });

  await mailer.sendWelcome(user.email);
  logger.info("registered", user);

  return user;
}
```

Problems:
- validation, persistence, notification, and logging are mixed
- error categories are unclear
- sensitive user data may be logged
- testing requires several infrastructure concerns

## After

```ts
function validateRegistration(input) {
  if (!input.email || !input.password) {
    throw new InvalidRegistrationError();
  }
}

async function registerUser(input, dependencies) {
  validateRegistration(input);

  const existing = await dependencies.users.findByEmail(input.email);
  if (existing) {
    throw new UserAlreadyExistsError(input.email);
  }

  const passwordHash = await dependencies.passwords.hash(input.password);

  const user = await dependencies.users.create({
    email: input.email,
    passwordHash,
  });

  await dependencies.notifications.sendWelcomeEmail(user.email);
  dependencies.audit.userRegistered(user.id);

  return user;
}
```

The exact split should follow the repository architecture; do not refactor into more layers merely because layers exist in this example.
