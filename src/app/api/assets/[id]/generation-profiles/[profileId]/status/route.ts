import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { canTransitionGenerationProfile } from "@/domain/assets/generation-profile-workflow";
import { CUSTOMER_ROLES, TECHNICAL_ROLES, canAccessParty } from "@/lib/access-control";
import { updateGenerationProfileStatusSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const PROFILE_ROLES = [...TECHNICAL_ROLES, "MANAGER", ...CUSTOMER_ROLES] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  try {
    const auth = await requireApiUser(PROFILE_ROLES);
    if (!auth.ok) return auth.response;
    const { id: assetId, profileId } = await params;
    const parsed = await parseJsonBody(request, updateGenerationProfileStatusSchema);
    if (!parsed.ok) return parsed.response;
    const profile = await prisma.generationProfileVersion.findUnique({ where: { id: profileId }, include: { asset: { select: { ownerId: true } } } });
    if (!profile || profile.assetId !== assetId) throw new BusinessRuleError("نسخه پیش‌بینی پیدا نشد.", "NOT_FOUND", 404);
    if (!canAccessParty(auth.user, profile.asset.ownerId)) throw new BusinessRuleError("به این دارایی دسترسی ندارید.", "FORBIDDEN", 403);
    if (!canTransitionGenerationProfile(profile.status, parsed.data.status, auth.user.role)) throw new BusinessRuleError("تغییر وضعیت پیش‌بینی مجاز نیست.", "CONFLICT", 409);
    const now = new Date();
    const audit = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.generationProfileVersion.updateMany({ where: { id: profileId, status: profile.status }, data: { status: parsed.data.status, ...(parsed.data.status === "REVIEW" && { submittedAt: now }), ...(parsed.data.status === "APPROVED" && { approvedBy: auth.user.id, approvedAt: now }) } });
      if (changed.count !== 1) throw new BusinessRuleError("نسخه پیش‌بینی هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      if (parsed.data.status === "APPROVED") {
        await transaction.generationProfileVersion.updateMany({ where: { assetId, year: profile.year, status: "APPROVED", id: { not: profileId } }, data: { status: "SUPERSEDED" } });
        await transaction.generationProfile.upsert({
          where: { assetId },
          create: { assetId, year: profile.year, method: profile.method, source: profile.source, jan: profile.jan, feb: profile.feb, mar: profile.mar, apr: profile.apr, may: profile.may, jun: profile.jun, jul: profile.jul, aug: profile.aug, sep: profile.sep, oct: profile.oct, nov: profile.nov, dec: profile.dec, annualTotal: profile.annualTotal, confidenceLevel: profile.confidenceLevel, version: profile.version, approvedBy: auth.user.id },
          update: { year: profile.year, method: profile.method, source: profile.source, jan: profile.jan, feb: profile.feb, mar: profile.mar, apr: profile.apr, may: profile.may, jun: profile.jun, jul: profile.jul, aug: profile.aug, sep: profile.sep, oct: profile.oct, nov: profile.nov, dec: profile.dec, annualTotal: profile.annualTotal, confidenceLevel: profile.confidenceLevel, version: profile.version, approvedBy: auth.user.id },
        });
      }
      await transaction.auditLog.create({ data: { entityType: "GenerationProfileVersion", entityId: profileId, action: "STATUS_CHANGE", userId: auth.user.id, changes: { from: profile.status, to: parsed.data.status, version: profile.version }, ...audit } });
      return transaction.generationProfileVersion.findUnique({ where: { id: profileId } });
    });
    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "transition generation profile version");
  }
}
