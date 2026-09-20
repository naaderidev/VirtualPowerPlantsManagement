# API Design Rules

- Make contracts explicit.
- Validate external inputs at the boundary.
- Return stable, predictable shapes.
- Distinguish domain errors from transport errors.
- Avoid leaking persistence models as public API contracts unless intentional.
- Make pagination, filtering, sorting, and idempotency semantics explicit where relevant.
- Preserve backward compatibility unless a breaking change is required.
