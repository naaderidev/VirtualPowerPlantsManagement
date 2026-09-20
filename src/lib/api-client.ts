export type ApiClientError = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string[]>;
    correlationId?: string;
  };
};

export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const { error } = payload as ApiClientError;
  const fieldMessage = error?.details
    ? Object.values(error.details).flat().find((message) => typeof message === "string")
    : undefined;
  return fieldMessage ?? (typeof error?.message === "string" ? error.message : fallback);
}
