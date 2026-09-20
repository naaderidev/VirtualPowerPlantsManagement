# Security Rules

For security-sensitive code:

- Validate and normalize untrusted input at boundaries.
- Enforce authentication and authorization explicitly.
- Protect against injection, XSS, CSRF, SSRF, path traversal, unsafe deserialization, prototype pollution, and similar threats as applicable.
- Never hardcode secrets.
- Do not log credentials, tokens, or sensitive personal data.
- Use least privilege.
- Treat client-side validation as UX, not authorization.
- Fail securely.
- Prefer established, maintained security libraries over handwritten cryptography.
