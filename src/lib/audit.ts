export type AuditMetadata = {
  correlationId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export function getAuditMetadata(request: Request, correlationId: string): AuditMetadata {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return {
    correlationId,
    ipAddress: forwardedFor || request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
