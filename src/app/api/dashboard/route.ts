import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, hasAnyRole, INTERNAL_ROLES, METER_READING_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { handleRouteError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(INTERNAL_ROLES);
    if (!auth.ok) return auth.response;
    const canViewFinancials = hasAnyRole(auth.user, FINANCIAL_ROLES);
    const canViewMetering = hasAnyRole(auth.user, METER_READING_ROLES);

    // Get counts
    const [
      totalParties,
      totalAssets,
      totalContracts,
      activeContracts,
      totalSettlements,
      pendingSettlements,
      totalReadings,
      pendingReadings,
      totalRequests,
      pendingRequests,
    ] = await Promise.all([
      prisma.party.count(),
      prisma.asset.count(),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: "ACTIVE" } }),
      canViewFinancials ? prisma.settlement.count() : Promise.resolve(0),
      canViewFinancials ? prisma.settlement.count({ where: { status: { in: ["CALCULATED", "UNDER_REVIEW"] } } }) : Promise.resolve(0),
      canViewMetering ? prisma.meterReading.count() : Promise.resolve(0),
      canViewMetering ? prisma.meterReading.count({ where: { status: "RAW" } }) : Promise.resolve(0),
      prisma.request.count(),
      prisma.request.count({ where: { status: { in: ["SUBMITTED", "INITIAL_REVIEW", "NEEDS_INFORMATION"] } } }),
    ]);

    // Get financial summary
    const settlements = canViewFinancials ? await prisma.settlement.findMany({
      select: {
        grossAmount: true,
        netAmount: true,
        status: true,
      },
    }) : [];

    const totalAmount = settlements.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalPaid = settlements
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + s.grossAmount, 0);

    // Get energy summary
    const readings = canViewMetering ? await prisma.meterReading.findMany({
      select: {
        rawEnergy: true,
        acceptedEnergy: true,
      },
    }) : [];

    const totalEnergy = readings.reduce((sum, r) => sum + r.rawEnergy, 0);
    const acceptedEnergy = readings
      .filter((r) => r.acceptedEnergy !== null)
      .reduce((sum, r) => sum + (r.acceptedEnergy || 0), 0);

    // Get recent activities
    const recentRequests = await prisma.request.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        party: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const recentSettlements = canViewFinancials ? await prisma.settlement.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        settlementNumber: true,
        grossAmount: true,
        status: true,
        createdAt: true,
        contract: {
          select: {
            contractNumber: true,
            parties: {
              select: {
                party: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    }) : [];

    return apiJson({
      access: { financials: canViewFinancials, metering: canViewMetering },
      stats: {
        totalParties,
        totalAssets,
        totalContracts,
        activeContracts,
        totalSettlements,
        pendingSettlements,
        totalReadings,
        pendingReadings,
        totalRequests,
        pendingRequests,
        totalAmount,
        totalPaid,
        totalEnergy,
        acceptedEnergy,
      },
      recentRequests,
      recentSettlements,
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch admin dashboard");
  }
}
