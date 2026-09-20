import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { CONTRACT_WRITE_ROLES, CUSTOMER_ROLES, INTERNAL_ROLES, isCustomerUser } from "@/lib/access-control";
import { updateContractSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { getStoredContractActivationReadiness } from "@/lib/contract-activation-readiness";
import { PATCH as transitionContract } from "../route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        parties: { include: { party: true } },
        assets: { include: { asset: true } },
        schedules: {
          include: { pricingPlan: true, asset: true },
          orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        },
        requests: {
          select: {
            id: true,
            caseNumber: true,
            assetId: true,
            createdAt: true,
            hasExistingContract: true,
            existingContractStart: true,
            existingContractEnd: true,
            existingContractCounterparty: true,
            existingContractCommittedCapacity: true,
            existingContractExclusive: true,
            existingContractRestrictions: true,
            existingContractRightToSellConfirmed: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        meteringAnnex: true,
        signatures: { include: { party: true, signedBy: { select: { id: true, name: true, role: true } } } },
        versions: { orderBy: { version: "desc" } },
        settlements: { orderBy: { createdAt: "desc" }, take: 5 },
        amendments: { orderBy: { createdAt: "desc" }, take: 5 },
        reviews: { include: { reviewer: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } },
        _count: { select: { settlements: true, amendments: true } },
      },
    });
    if (!contract) return apiError(404, "NOT_FOUND", "قرارداد پیدا نشد.", { request });
    if (isCustomerUser(auth.user) && !contract.parties.some(({ partyId }) => auth.user.accessiblePartyIds.includes(partyId))) return forbiddenResponse();
    const activationReadiness = await getStoredContractActivationReadiness(contract.id);
    return apiJson({ ...contract, activationReadiness });
  } catch (error) {
    return handleRouteError(request, error, "fetch contract");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = await parseJsonBody(request, updateContractSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;

    if ("action" in parsed.data) {
      const auth = await requireApiUser(CONTRACT_WRITE_ROLES);
      if (!auth.ok) return auth.response;
      const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
      const audit = getAuditMetadata(request, parsed.correlationId);
      const review = await prisma.$transaction(async (transaction) => {
        const created = await transaction.contractReview.create({
          data: {
            contractId: id,
            reviewerId: auth.user.id,
            action: "NOTE",
            notes: parsed.data.notes,
          },
          include: { reviewer: { select: { id: true, name: true, role: true } } },
        });
        await transaction.auditLog.create({
          data: {
            entityType: "Contract",
            entityId: id,
            action: "NOTE",
            userId: auth.user.id,
            changes: { notes: parsed.data.notes },
            ...audit,
          },
        });
        return created;
      });
      return apiJson(review);
    }

    const forwarded = new Request(request.url, {
      method: "PATCH",
      headers: request.headers,
      body: JSON.stringify({ id, status: parsed.data.status, notes: parsed.data.notes }),
    });
    return transitionContract(forwarded as never);
  } catch (error) {
    return handleRouteError(request, error, "update contract");
  }
}
