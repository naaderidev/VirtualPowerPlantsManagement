const SAFE_IDENTIFIER = /^[A-Za-z0-9._-]{1,100}$/;

function safeIdentifier(value: string | undefined, fallback: string): string {
  return value && SAFE_IDENTIFIER.test(value) ? value : fallback;
}

export function getReleaseMetadata() {
  return {
    environment: safeIdentifier(process.env.APP_ENV, "development"),
    release: safeIdentifier(process.env.RELEASE_ID, "local"),
  };
}
