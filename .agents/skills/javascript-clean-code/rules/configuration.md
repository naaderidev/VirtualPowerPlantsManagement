# Configuration Rules

- Keep configuration explicit and centralized.
- Validate required environment/configuration values at startup or boundary time.
- Do not scatter environment-variable reads throughout business logic.
- Distinguish configuration from mutable runtime state.
- Provide safe defaults only when the default is genuinely safe.
- Never commit secrets.
