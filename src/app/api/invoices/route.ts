import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, FINANCIAL_ROLES, isCustomerUser } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createInvoiceSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { independentInvoiceRestriction } from "@/domain/billing/independent-invoice";

/**
 * POST /api/invoices
 * صدور صورتحساب برای یک تسویه تأیید شده
 */
export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createInvoiceSchema);
    if (!parsed.ok) return parsed.response;
    const { settlementId, notes } = parsed.data;

    // 1. پیدا کردن تسویه
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        contract: {
          include: {
            parties: { include: { party: true } },
            nettingGroup: { select: { active: true, mode: true } },
          },
        },
        invoice: true,
        nettingItems: { where: { eligibilityLockKey: { not: null } }, select: { id: true } },
        schedule: true,
      },
    });

    if (!settlement) {
      throw new BusinessRuleError("تسویه پیدا نشد.", "NOT_FOUND", 404);
    }

    if (settlement.invoice) {
      return apiJson(settlement.invoice);
    }

    const invoiceRestriction = independentInvoiceRestriction({
      hasNettingReservation: settlement.nettingItems.length > 0,
      contractNettingEnabled: settlement.contract.nettingEnabled,
      scheduleNettingEnabled: settlement.schedule?.nettingEnabled ?? false,
      nettingGroup: settlement.contract.nettingGroup,
    });
    if (invoiceRestriction) throw new BusinessRuleError(invoiceRestriction, "CONFLICT", 409);

    if (settlement.status !== "CONFIRMED") {
      throw new BusinessRuleError("فقط تسویه تأییدشده قابل صدور صورتحساب است.");
    }

    // 2. تولید شماره صورتحساب
    const now = new Date();
    const invoiceNumber = `INV-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    // 3. تاریخ سررسید از برنامه تجاری/قرارداد
    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() + (settlement.schedule?.paymentDueDays ?? settlement.contract.paymentDueDays ?? 30));
    const audit = getAuditMetadata(request, parsed.correlationId);

    // 4. ایجاد صورتحساب
    const invoice = await prisma.$transaction(async (transaction) => {
      const statusUpdate = await transaction.settlement.updateMany({ where: { id: settlementId, status: "CONFIRMED" }, data: { status: "INVOICED" } });
      if (statusUpdate.count !== 1) throw new BusinessRuleError("وضعیت تسویه هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      const created = await transaction.invoice.create({
        data: {
          invoiceNumber,
          settlementId,
          amount: settlement.netAmount,
          amountDecimal: settlement.netAmount,
          currency: "IRR",
          issueDate: now,
          dueDate,
          status: "ISSUED",
          notes: notes ?? `صورتحساب تسویه ${settlement.settlementNumber}`,
        },
        include: {
          settlement: {
            include: {
              contract: {
                include: {
                  parties: { include: { party: true } },
                },
              },
              asset: true,
            },
          },
        },
      });
      await transaction.auditLog.create({ data: { entityType: "Invoice", entityId: created.id, action: "ISSUE", userId: auth.user.id, changes: { settlementId, amount: settlement.netAmount, issueDate: now, dueDate, paymentDueDays: settlement.schedule?.paymentDueDays ?? settlement.contract.paymentDueDays ?? 30 }, ...audit } });
      return created;
    });

    return apiJson(invoice, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(request, error, "create invoice");
  }
}

/**
 * GET /api/invoices
 * دریافت لیست صورتحساب‌ها
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    if (isCustomerUser(auth.user) && auth.user.accessiblePartyIds.length === 0) {
      return apiJson([]);
    }

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;

    const invoices = await prisma.invoice.findMany({
      where: isCustomerUser(auth.user)
        ? {
            settlement: {
              contract: { parties: { some: { partyId: { in: auth.user.accessiblePartyIds } } } },
            },
          }
        : undefined,
      include: {
        settlement: {
          include: {
            contract: {
              include: {
                parties: { include: { party: true } },
              },
            },
            asset: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiJson(invoices);
  } catch (error) {
    return handleRouteError(request, error, "fetch invoices");
  }
}
