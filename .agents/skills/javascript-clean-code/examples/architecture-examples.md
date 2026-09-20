# Architecture Examples

## Small module

For a small feature, a few focused modules may be enough:

```text
feature/
  create-order.ts
  calculate-total.ts
  order.test.ts
```

## Medium application

```text
src/
  domain/
  application/
  infrastructure/
  http/
```

Keep boundaries meaningful. Do not create empty layers.

## Larger system

For a larger system, explicit domain/application/infrastructure boundaries can help:

```text
src/
  modules/
    orders/
      domain/
      application/
      infrastructure/
      http/
  shared/
```

The structure should emerge from real change and ownership boundaries.

## Principle

Architecture exists to make change safer. If an architectural element does not improve a real change boundary, question whether it belongs.
