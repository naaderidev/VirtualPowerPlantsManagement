// Local starts read the same .env files as Next.js. Deployed production
// processes must receive their environment from the runtime.
if (process.env.NODE_ENV !== "production" && process.env.APP_ENV !== "production") {
  const { default: nextEnvironment } = await import("@next/env");
  nextEnvironment.loadEnvConfig(process.cwd(), true);
  if (process.env.APP_ENV === "production") {
    throw new Error("Production runtime variables must be provided by the environment, not .env files.");
  }
}

await import("./start-production.mjs");
