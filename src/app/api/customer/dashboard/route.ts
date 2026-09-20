import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { handleRouteError } from "@/lib/api-response";
import { canCreateCustomerRequest } from "@/lib/ui-access";
import { resolveRequestStatusFromSettlements } from "@/domain/requests/financial-progress";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(CUSTOMER_ROLES);
    if (!auth.ok) return auth.response;

    const partyIds = auth.user.accessiblePartyIds;
    const mayCreateRequest = canCreateCustomerRequest(auth.user.role, partyIds.length);
    if (partyIds.length === 0) {
      return apiJson({
        requests: [],
        canCreateRequest: mayCreateRequest,
        hasActingParty: false,
        requiresRepresentativeAssignment:
          auth.user.role === "CUSTOMER_REPRESENTATIVE" &&
          auth.user.representedParties.length === 0,
        requiresActingPartySelection:
          auth.user.role === "CUSTOMER_REPRESENTATIVE" &&
          auth.user.representedParties.length > 0,
        stats: {
          totalRequests: 0,
          activeRequests: 0,
          totalAssets: 0,
          totalContracts: 0,
        },
      });
    }

    // Get requests for this party
    const requests = await prisma.request.findMany({
      where: { partyId: { in: partyIds } },
      include: { contract: { select: { settlements: { select: { status: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const requestsWithFinancialProgress = requests.map(({ contract, ...requestRecord }) => ({
      ...requestRecord,
      status: resolveRequestStatusFromSettlements(
        requestRecord.status,
        contract?.settlements.map((settlement) => settlement.status) ?? [],
      ),
    }));

    // Get stats
    const [totalRequests, activeRequests, totalAssets, totalContracts] = await Promise.all([
      prisma.request.count({ where: { partyId: { in: partyIds } } }),
      prisma.request.count({
        where: {
          partyId: { in: partyIds },
          status: { in: ["SUBMITTED", "INITIAL_REVIEW", "NEEDS_INFORMATION"] },
        },
      }),
      prisma.asset.count({ where: { ownerId: { in: partyIds } } }),
      prisma.contractParty.count({
        where: {
          partyId: { in: partyIds },
          contract: { status: { in: ["ACTIVE", "TERMINATION_PENDING"] } },
        },
      }),
    ]);

    return apiJson({
      requests: requestsWithFinancialProgress,
      canCreateRequest: mayCreateRequest,
      hasActingParty: true,
      requiresRepresentativeAssignment: false,
      requiresActingPartySelection: false,
      stats: {
        totalRequests,
        activeRequests,
        totalAssets,
        totalContracts,
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch customer dashboard");
  }
}
