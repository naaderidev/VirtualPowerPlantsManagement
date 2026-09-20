import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { getReleaseMetadata } from "@/lib/release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return apiJson(
    { status: "ok", ...getReleaseMetadata(), uptimeSeconds: Math.floor(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
