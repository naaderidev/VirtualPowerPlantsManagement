# Objects and Data Structures

- Encapsulate invariants where behavior belongs with data.
- Keep DTOs simple when their purpose is transport.
- Do not expose mutable internal state unnecessarily.
- Avoid Law-of-Demeter violations and long chains when they indicate missing boundaries.
- Choose a deliberate `null`/`undefined` strategy.
- Make mutation ownership clear.
- Do not add getters/setters mechanically; use them when they protect meaningful invariants or provide a useful API.
