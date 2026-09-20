import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  CONTRACT_SIGN_ROLES,
  canAccessParty,
  canSignForParty,
  isCustomerUser,
} from "@/lib/access-control";
import { signContractSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { getStoredContractActivationReadiness } from "@/lib/contract-activation-readiness";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(CONTRACT_SIGN_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, signContractSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const { partyId, evidenceReference } = parsed.data;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { parties: true, signatures: true },
    });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    const activationReadiness = await getStoredContractActivationReadiness(id);
    const existing = contract.signatures.find((signature) => signature.partyId === partyId);
    if (existing) return apiJson(existing);
    if (contract.status !== "PENDING_SIGNATURE") {
      throw new BusinessRuleError("قرارداد در وضعیت آماده امضا نیست.", "CONFLICT", 409);
    }
    const party = contract.parties.find((item) => item.partyId === partyId && item.isPrimary);
    if (!party || !["BUYER", "SELLER"].includes(party.role)) {
      throw new BusinessRuleError("طرف اصلی قرارداد برای امضا معتبر نیست.", "VALIDATION_ERROR", 422);
    }
    if (isCustomerUser(auth.user)) {
      if (
        party.role !== "SELLER" ||
        !canAccessParty(auth.user, partyId) ||
        !canSignForParty(auth.user, partyId)
      ) {
        throw new BusinessRuleError("مشتری فقط مجاز به امضای طرف فروشنده تحت اختیار خود است.", "FORBIDDEN", 403);
      }
    } else if (party.role !== "BUYER") {
      throw new BusinessRuleError("امضای داخلی فقط برای طرف خریدار برقتو قابل ثبت است.", "FORBIDDEN", 403);
    }

    const audit = getAuditMetadata(request, parsed.correlationId);
    const result = await prisma.$transaction(async (transaction) => {
      const signature = await transaction.contractSignature.upsert({
        where: { contractId_partyId: { contractId: id, partyId } },
        create: { contractId: id, partyId, signedById: auth.user.id, evidenceReference },
        update: {},
      });
      await transaction.auditLog.create({
        data: {
          entityType: "ContractSignature",
          entityId: signature.id,
          action: "SIGN",
          userId: auth.user.id,
          changes: { contractId: id, partyId, evidenceReference },
          ...audit,
        },
      });
      const requiredPartyIds = contract.parties
        .filter((item) => item.isPrimary && ["BUYER", "SELLER"].includes(item.role))
        .map((item) => item.partyId);
      const signatureCount = await transaction.contractSignature.count({
        where: { contractId: id, partyId: { in: requiredPartyIds } },
      });
      if (new Set(requiredPartyIds).size === 2 && signatureCount === 2) {
        const changed = await transaction.contract.updateMany({
          where: { id, status: "PENDING_SIGNATURE" },
          data: { status: "SIGNED", signedAt: new Date() },
        });
        if (changed.count === 1) {
          await transaction.request.updateMany({ where: { contractId: id, status: "CONTRACT_PENDING" }, data: { status: "CONTRACT_SIGNED" } });
          await transaction.contractReview.create({
            data: { contractId: id, reviewerId: auth.user.id, action: "ALL_PARTIES_SIGNED", fromStatus: "PENDING_SIGNATURE", toStatus: "SIGNED" },
          });
          const snapshotSource = await transaction.contract.findUnique({
            where: { id },
            include: { parties: true, assets: true, schedules: true, meteringAnnex: true, signatures: true },
          });
          const snapshot = JSON.parse(JSON.stringify(snapshotSource)) as Prisma.InputJsonValue;
          await transaction.contractVersion.upsert({
            where: { contractId_version: { contractId: id, version: contract.version } },
            create: { contractId: id, version: contract.version, snapshot, createdBy: auth.user.id },
            update: {},
          });
          const sellerPartyIds = contract.parties.filter(({ role }) => role === "SELLER").map(({ partyId: sellerPartyId }) => sellerPartyId);
          const linkedRequests = await transaction.request.findMany({ where: { contractId: id }, select: { initiatorId: true } });
          const initiatorIds = linkedRequests.map(({ initiatorId }) => initiatorId).filter((userId): userId is string => Boolean(userId));
          const [customerRecipients, internalRecipients] = await Promise.all([
            transaction.user.findMany({ where: { active: true, OR: [{ partyId: { in: sellerPartyIds } }, { id: { in: initiatorIds } }] }, select: { id: true } }),
            transaction.user.findMany({ where: { active: true, role: { in: ["ADMIN", "STAFF_SUPPLY", "STAFF_TECHNICAL"] } }, select: { id: true } }),
          ]);
          const title = activationReadiness?.ready
            ? `قرارداد ${contract.contractNumber} آماده فعال‌سازی است`
            : activationReadiness?.awaitingOperation
              ? `قرارداد ${contract.contractNumber} امضا شد؛ در انتظار بهره‌برداری`
              : `قرارداد ${contract.contractNumber} امضا شد؛ نیازمند رفع تعارض فروش`;
          const message = activationReadiness?.ready
            ? "همه امضاها و الزامات بهره‌برداری تکمیل شده‌اند."
            : (activationReadiness?.blockers.join(" ") || "پیش از فعال‌سازی، الزامات قرارداد را تکمیل کنید.");
          await transaction.notification.createMany({
            data: [
              ...customerRecipients.map(({ id: userId }) => ({ userId, partyId: sellerPartyIds[0], title, message, type: "CONTRACT" as const, link: `/customer/contracts/${id}` })),
              ...internalRecipients.map(({ id: userId }) => ({ userId, title, message, type: "CONTRACT" as const, link: `/admin/contracts/${id}` })),
            ],
          });
        }
      }
      return transaction.contract.findUnique({
        where: { id },
        include: { signatures: true, versions: { orderBy: { version: "desc" } } },
      });
    });
    return apiJson(result);
  } catch (error) {
    return handleRouteError(request, error, "sign contract");
  }
}
