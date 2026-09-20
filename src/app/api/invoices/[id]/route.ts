import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  FINANCIAL_ROLES,
  isCustomerUser,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { updateInvoiceSchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { BusinessRuleError } from "@/lib/api-response";
import { canManuallyTransitionInvoice } from "@/domain/billing/invoice-workflow";
import { getAuditMetadata } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
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

    if (!invoice) {
      return apiError(404, "NOT_FOUND", "صورتحساب پیدا نشد.", { request });
    }

    if (
      isCustomerUser(auth.user) &&
      !invoice.settlement.contract.parties.some(({ party }) =>
        auth.user.accessiblePartyIds.includes(party.id)
      )
    ) {
      return forbiddenResponse();
    }

    return apiJson(invoice);
  } catch (error) {
    return handleRouteError(request, error, "fetch invoice");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateInvoiceSchema);
    if (!parsed.ok) return parsed.response;
    const { status } = parsed.data;

    // Get the invoice first to find the settlementId
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      select: { settlementId: true, status: true, allocationVersion: true },
    });

    if (!existingInvoice) {
      return apiError(404, "NOT_FOUND", "صورتحساب پیدا نشد.", { request });
    }

    if (!canManuallyTransitionInvoice(existingInvoice.status, status)) {
      throw new BusinessRuleError("تغییر وضعیت صورتحساب مجاز نیست؛ وضعیت‌های پرداختی فقط از تخصیص پرداخت محاسبه می‌شوند.", "CONFLICT", 409);
    }
    const audit = getAuditMetadata(request, parsed.correlationId);
    const invoice = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.invoice.updateMany({ where: { id, status: existingInvoice.status, allocationVersion: existingInvoice.allocationVersion }, data: { status } });
      if (changed.count !== 1) throw new BusinessRuleError("صورتحساب هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.auditLog.create({ data: { entityType: "Invoice", entityId: id, action: "STATUS_CHANGE", userId: auth.user.id, changes: { from: existingInvoice.status, to: status }, ...audit } });
      return transaction.invoice.findUnique({
        where: { id },
        include: {
          settlement: {
            include: {
              contract: { include: { parties: { include: { party: true } } } },
              asset: true,
            },
          },
          allocations: true,
        },
      });
    });

    return apiJson(invoice);
  } catch (error) {
    return handleRouteError(request, error, "update invoice");
  }
}
