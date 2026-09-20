import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { CUSTOMER_ROLES, TECHNICAL_ROLES, canAccessParty } from "@/lib/access-control";
import { createGenerationProfileVersionSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const PROFILE_ROLES = [...TECHNICAL_ROLES, "MANAGER", ...CUSTOMER_ROLES] as const;

async function requireAccessibleAsset(assetId: string, user: Parameters<typeof canAccessParty>[0]) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, ownerId: true } });
  if (!asset) throw new BusinessRuleError("دارایی پیدا نشد.", "NOT_FOUND", 404);
  if (!canAccessParty(user, asset.ownerId)) throw new BusinessRuleError("به پیش‌بینی این دارایی دسترسی ندارید.", "FORBIDDEN", 403);
  return asset;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PROFILE_ROLES);
    if (!auth.ok) return auth.response;
    const { id: assetId } = await params;
    await requireAccessibleAsset(assetId, auth.user);
    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const profiles = await prisma.generationProfileVersion.findMany({
      where: { assetId }, orderBy: [{ year: "desc" }, { version: "desc" }],
      skip: (query.data.page - 1) * query.data.limit, take: query.data.limit,
    });
    return apiJson(profiles);
  } catch (error) {
    return handleRouteError(request, error, "fetch generation profile versions");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PROFILE_ROLES);
    if (!auth.ok) return auth.response;
    const { id: assetId } = await params;
    await requireAccessibleAsset(assetId, auth.user);
    const parsed = await parseJsonBody(request, createGenerationProfileVersionSchema);
    if (!parsed.ok) return parsed.response;
    const latest = await prisma.generationProfileVersion.findFirst({ where: { assetId, year: parsed.data.year }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version ?? 0) + 1;
    const annualTotal = [parsed.data.jan, parsed.data.feb, parsed.data.mar, parsed.data.apr, parsed.data.may, parsed.data.jun, parsed.data.jul, parsed.data.aug, parsed.data.sep, parsed.data.oct, parsed.data.nov, parsed.data.dec].reduce((sum, month) => sum + month, 0);
    const audit = getAuditMetadata(request, parsed.correlationId);
    const profile = await prisma.$transaction(async (transaction) => {
      const created = await transaction.generationProfileVersion.create({ data: { assetId, ...parsed.data, annualTotal, version, status: "DRAFT", createdBy: auth.user.id } });
      await transaction.auditLog.create({ data: { entityType: "GenerationProfileVersion", entityId: created.id, action: "CREATE_VERSION", userId: auth.user.id, changes: { assetId, year: created.year, version, annualTotal }, ...audit } });
      return created;
    });
    return apiJson(profile, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create generation profile version");
  }
}
