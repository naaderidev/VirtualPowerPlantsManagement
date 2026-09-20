# Architecture Rules

Use the smallest architecture that safely supports current requirements.

Possible boundaries include:
- domain
- application/use cases
- infrastructure
- transport/interface

These are options, not mandatory layers.

Avoid speculative:
- microservices
- CQRS
- event sourcing
- message buses
- repository layers
- generic factories
- DI containers

Controllers/handlers SHOULD be thin. Domain logic SHOULD not depend on HTTP or database details when that separation has meaningful value.
