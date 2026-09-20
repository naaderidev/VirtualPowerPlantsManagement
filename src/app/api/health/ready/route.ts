import { apiJson } from "@/lib/api-response";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReleaseMetadata } from "@/lib/release";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const READINESS_TIMEOUT_MS = 2_000;

async function verifyDatabase(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Database readiness timed out")), READINESS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const correlationId = randomUUID();
  try {
    await verifyDatabase();
    return apiJson(
      { status: "ready", ...getReleaseMetadata() },
      { headers: { "Cache-Control": "no-store", "x-correlation-id": correlationId } }
    );
  } catch (error) {
    logError("health.readiness.failed", error, { correlationId, dependency: "database" });
    return apiJson(
      { status: "not_ready", correlationId },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5", "x-correlation-id": correlationId } }
    );
  }
}
