# Bad vs Good

## Naming

Bad:
```ts
function getData(d) {}
```

Good:
```ts
function findActiveUsers(users) {}
```

## Deep nesting

Bad:
```ts
if (user) {
  if (user.active) {
    if (user.canPublish) {
      publish(user);
    }
  }
}
```

Good:
```ts
if (!user) return;
if (!user.active) return;
if (!user.canPublish) return;

publish(user);
```

## Hidden side effect

Bad:
```ts
function calculateTotal(order) {
  audit(order);
  return order.items.reduce((sum, item) => sum + item.price, 0);
}
```

Good:
```ts
function calculateTotal(order) {
  return order.items.reduce((sum, item) => sum + item.price, 0);
}

audit(order);
```

## Speculative abstraction

Bad:
```ts
class UserServiceFactoryProviderManager {
  createUserService() {
    return new UserService();
  }
}
```

Good:
```ts
const user = createUser(input);
```
