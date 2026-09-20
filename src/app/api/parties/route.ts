import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERNAL_ROLES, SUPPLY_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createPartySchema, partyListQuerySchema } from "@/lib/api-schemas";
import { handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";

// GET /api/parties - Get all parties
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(INTERNAL_ROLES);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, partyListQuerySchema);
    if (!query.ok) return query.response;
    const { type, status, page, limit } = query.data;

    const where: Prisma.PartyWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              assets: true,
              requests: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.party.count({ where }),
    ]);

    return apiJson({
      parties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch parties");
  }
}

// POST /api/parties - Create a new party
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createPartySchema);
    if (!parsed.ok) return parsed.response;
    const { type, displayName, economicCode, nationalId, registrationNo, taxId, phone, email, address } = parsed.data;

    const party = await prisma.party.create({
      data: {
        type,
        displayName,
        economicCode,
        nationalId,
        registrationNo,
        taxId,
        phone,
        email,
        address,
      },
    });

    return apiJson(party, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create party");
  }
}
