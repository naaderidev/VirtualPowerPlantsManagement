import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { NETTING_CREATE_ROLES, NETTING_READ_ROLES, hasAnyRole } from "@/lib/access-control";
import { updateNettingBatchSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { isNettingEnabled } from "@/lib/netting-feature";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const batchInclude = {
  group: { include: { party: { select: { id: true, displayName: true } } } },
  items: {
    include: {
      settlement: {
        include: {
          asset: { select: { id: true, name: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      },
    },
  },
  approvals: {
    include: { reviewer: { select: { id: true, name: true, role: true } } },
    orderBy: { decidedAt: "asc" as const },
  },
  statement: { include: { allocations: true } },
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(NETTING_READ_ROLES);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const batch = await prisma.nettingBatch.findUnique({ where: { id }, include: batchInclude });
    if (!batch) return apiError(404, "NOT_FOUND", "دسته خالص‌سازی پیدا نشد.", { request });
    return apiJson({ enabled: isNettingEnabled(), batch });
  } catch (error) {
    return handleRouteError(request, error, "fetch netting batch");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(NETTING_READ_ROLES);
    if (!auth.ok) return auth.response;
    if (!isNettingEnabled()) {
      throw new BusinessRuleError("قابلیت خالص‌سازی در این محیط فعال نیست.", "CONFLICT", 409);
    }
    const parsed = await parseJsonBody(request, updateNettingBatchSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const existing = await prisma.nettingBatch.findUnique({
      where: { id },
      include: { approvals: true },
    });
    if (!existing) throw new BusinessRuleError("دسته خالص‌سازی پیدا نشد.", "NOT_FOUND", 404);

    const { action } = parsed.data;
    let nextStatus: "FINANCIAL_REVIEW" | "LEGAL_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
    let approvalType: "FINANCIAL" | "LEGAL" | null = null;
    let decision: "APPROVED" | "REJECTED" | null = null;
    if (action === "SUBMIT") {
      if (existing.status !== "DRAFT") throw new BusinessRuleError("فقط پیش‌نویس قابل ارسال برای بررسی است.", "CONFLICT", 409);
      if (!hasAnyRole(auth.user, NETTING_CREATE_ROLES)) {
        throw new BusinessRuleError("اجازه ارسال این دسته را ندارید.", "FORBIDDEN", 403);
      }
      nextStatus = "FINANCIAL_REVIEW";
    } else if (action === "CANCEL") {
      if (existing.status !== "DRAFT") throw new BusinessRuleError("فقط پیش‌نویس قابل لغو است.", "CONFLICT", 409);
      if (auth.user.role !== "ADMIN" && existing.createdById !== auth.user.id) {
        throw new BusinessRuleError("اجازه لغو این دسته را ندارید.", "FORBIDDEN", 403);
      }
      nextStatus = "CANCELLED";
    } else {
      decision = action === "APPROVE" ? "APPROVED" : "REJECTED";
      if (existing.status === "FINANCIAL_REVIEW") {
        if (auth.user.role !== "STAFF_FINANCIAL") {
          throw new BusinessRuleError("این مرحله فقط توسط کارشناس مالی قابل بررسی است.", "FORBIDDEN", 403);
        }
        approvalType = "FINANCIAL";
        nextStatus = decision === "APPROVED" ? "LEGAL_REVIEW" : "REJECTED";
      } else if (existing.status === "LEGAL_REVIEW") {
        if (auth.user.role !== "STAFF_LEGAL") {
          throw new BusinessRuleError("این مرحله فقط توسط کارشناس حقوقی قابل بررسی است.", "FORBIDDEN", 403);
        }
        const financialApproval = existing.approvals.find(
          ({ type, decision: approvalDecision }) => type === "FINANCIAL" && approvalDecision === "APPROVED"
        );
        if (!financialApproval) throw new BusinessRuleError("تأیید مالی معتبر برای این دسته وجود ندارد.");
        if (financialApproval.reviewerId === auth.user.id) {
          throw new BusinessRuleError("تأییدکنندگان مالی و حقوقی باید دو کاربر متفاوت باشند.");
        }
        approvalType = "LEGAL";
        nextStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
      } else {
        throw new BusinessRuleError("این دسته در وضعیت قابل بررسی نیست.", "CONFLICT", 409);
      }
    }

    const notes = "notes" in parsed.data ? parsed.data.notes : null;
    const now = new Date();
    const audit = getAuditMetadata(request, parsed.correlationId);
    const batch = await prisma.$transaction(async (transaction) => {
      if (approvalType && decision) {
        await transaction.nettingApproval.create({
          data: { batchId: id, type: approvalType, decision, reviewerId: auth.user.id, notes },
        });
      }
      const changed = await transaction.nettingBatch.updateMany({
        where: { id, status: existing.status },
        data: {
          status: nextStatus,
          ...(action === "SUBMIT" && { submittedAt: now }),
          ...(nextStatus === "APPROVED" && { approvedAt: now }),
          ...(nextStatus === "REJECTED" && { rejectionReason: notes }),
        },
      });
      if (changed.count !== 1) {
        throw new BusinessRuleError("وضعیت دسته خالص‌سازی هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      }
      if (nextStatus === "REJECTED" || nextStatus === "CANCELLED") {
        await transaction.nettingItem.updateMany({
          where: { batchId: id, eligibilityLockKey: { not: null } },
          data: { eligibilityLockKey: null, releasedAt: now },
        });
      }
      await transaction.auditLog.create({
        data: {
          entityType: "NettingBatch",
          entityId: id,
          action: approvalType ? `${approvalType}_${decision}` : action,
          userId: auth.user.id,
          changes: { before: { status: existing.status }, after: { status: nextStatus }, notes },
          ...audit,
        },
      });
      return transaction.nettingBatch.findUniqueOrThrow({ where: { id }, include: batchInclude });
    });
    return apiJson(batch);
  } catch (error) {
    return handleRouteError(request, error, "update netting batch");
  }
}
