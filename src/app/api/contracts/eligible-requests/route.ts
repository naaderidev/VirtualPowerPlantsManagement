import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { SUPPLY_ROLES } from "@/lib/access-control";
import { eligibleContractRequestQuerySchema } from "@/lib/api-schemas";
import { handleRouteError, parseSearchParams } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const eligibleRequestSelect = {
  id: true,
  caseNumber: true,
  partyId: true,
  capacity: true,
  createdAt: true,
  party: { select: { displayName: true, type: true } },
  asset: {
    select: {
      id: true,
      name: true,
      capacityNominal: true,
      operationalDate: true,
    },
  },
  proposals: {
    where: { status: "ACCEPTED" as const },
    select: { duration: true },
    take: 1,
  },
} satisfies Prisma.RequestSelect;

function buildEligibleRequestFilter(
  mode: "SINGLE" | "MASTER",
  search?: string,
): Prisma.RequestWhereInput {
  return {
    status: "PROPOSAL_ACCEPTED",
    contractId: null,
    assetId: { not: null },
    proposals: { some: { status: "ACCEPTED" } },
    party: {
      is: {
        status: "ACTIVE",
        ...(mode === "MASTER" && { type: "COMPANY" }),
      },
    },
    ...(search && {
      OR: [
        { caseNumber: { contains: search } },
        { party: { is: { displayName: { contains: search } } } },
        { asset: { is: { name: { contains: search } } } },
      ],
    }),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = parseSearchParams(request, eligibleContractRequestQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { mode, search, requestId, page, limit } = parsed.data;
    const where = buildEligibleRequestFilter(mode, search);

    const [requests, total, initialRequest] = await Promise.all([
      prisma.request.findMany({
        where,
        select: eligibleRequestSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.request.count({ where }),
      requestId
        ? prisma.request.findFirst({
            where: { AND: [buildEligibleRequestFilter(mode), { id: requestId }] },
            select: eligibleRequestSelect,
          })
        : Promise.resolve(null),
    ]);

    return apiJson({
      requests,
      initialRequest,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch eligible contract requests");
  }
}
