import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { handleRouteError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const settlements = await prisma.settlement.findMany({
      include: {
        contract: {
          include: {
            parties: {
              include: {
                party: true,
              },
            },
          },
        },
      },
    });

    const totalAmount = settlements.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalPaid = settlements
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + s.grossAmount, 0);
    const totalPending = totalAmount - totalPaid;

    const byStatus = settlements.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activeContracts = await prisma.contract.count({
      where: { status: "ACTIVE" },
    });

    const recentSettlements = settlements.slice(0, 5);

    return apiJson({
      summary: {
        totalSettlements: settlements.length,
        totalAmount,
        totalPaid,
        totalPending,
        activeContracts,
        byStatus,
      },
      recentSettlements,
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch financial report");
  }
}
