const IDENTIFIER = /^[A-Za-z0-9._-]{1,100}$/;
const ALLOWED_ENVIRONMENTS = new Set(["development", "test", "ci", "staging", "production"]);

function validUrl(value, protocols) {
  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateRuntimeEnvironment(environment = process.env) {
  const errors = [];
  const appEnvironment = environment.APP_ENV;
  if (!appEnvironment || !ALLOWED_ENVIRONMENTS.has(appEnvironment)) {
    errors.push("APP_ENV must be development, test, ci, staging, or production.");
  }
  if (!environment.RELEASE_ID || !IDENTIFIER.test(environment.RELEASE_ID)) {
    errors.push("RELEASE_ID must be a safe identifier with 1 to 100 characters.");
  }
  if (!environment.DATABASE_URL || !validUrl(environment.DATABASE_URL, new Set(["mysql:"]))) {
    errors.push("DATABASE_URL must be a valid MySQL URL.");
  }
  if (!environment.NEXTAUTH_SECRET || environment.NEXTAUTH_SECRET.length < 32 || /your-secret|change-me/i.test(environment.NEXTAUTH_SECRET)) {
    errors.push("NEXTAUTH_SECRET must contain at least 32 non-placeholder characters.");
  }
  if (!environment.NEXTAUTH_URL || !validUrl(environment.NEXTAUTH_URL, new Set(["http:", "https:"]))) {
    errors.push("NEXTAUTH_URL must be a valid HTTP(S) URL.");
  } else if (appEnvironment === "production" && new URL(environment.NEXTAUTH_URL).protocol !== "https:") {
    errors.push("NEXTAUTH_URL must use HTTPS in production.");
  }
  const uploadDirectory = environment.UPLOAD_DIR?.replaceAll("\\", "/").toLowerCase();
  const uploadSegments = uploadDirectory?.split("/").filter(Boolean) ?? [];
  if (!uploadDirectory || uploadSegments.includes("public")) {
    errors.push("UPLOAD_DIR must be configured outside the public directory.");
  }
  if (errors.length) throw new Error(`Invalid runtime environment:\n- ${errors.join("\n- ")}`);
  return { appEnvironment, releaseId: environment.RELEASE_ID };
}
