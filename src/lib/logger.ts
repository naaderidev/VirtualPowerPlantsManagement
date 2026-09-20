import { getReleaseMetadata } from "@/lib/release";

type LogContext = Record<string, string | number | boolean | null | undefined>;

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { errorType: "UnknownError" };
  return {
    errorType: error.name,
    ...(process.env.NODE_ENV !== "production" && { errorMessage: error.message }),
  };
}

function write(level: "info" | "warn" | "error", event: string, context: LogContext) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...getReleaseMetadata(),
    ...context,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function logInfo(event: string, context: LogContext = {}) {
  write("info", event, context);
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  write("error", event, { ...context, ...errorDetails(error) });
}
