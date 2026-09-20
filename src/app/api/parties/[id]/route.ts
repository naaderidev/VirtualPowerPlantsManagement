import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  INTERNAL_ROLES,
  PARTY_WRITE_ROLES,
  canAccessParty,
  isCustomerUser,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { updatePartySchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    if (!canAccessParty(auth.user, id)) return forbiddenResponse();

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        assets: {
          select: {
            id: true,
            name: true,
            type: true,
            capacityNominal: true,
          },
        },
        contractParties: {
          select: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!party) {
      return apiError(404, "NOT_FOUND", "طرف قرارداد پیدا نشد.", { request });
    }

    const partyWithContracts = {
      ...party,
      contracts: party.contractParties.map((cp) => cp.contract),
    };

    return apiJson(partyWithContracts);
  } catch (error) {
    return handleRouteError(request, error, "fetch party");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...PARTY_WRITE_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!canAccessParty(auth.user, id)) return forbiddenResponse();

    const parsed = await parseJsonBody(request, updatePartySchema);
    if (!parsed.ok) return parsed.response;

    const {
      displayName,
      economicCode,
      nationalId,
      registrationNo,
      taxId,
      phone,
      email,
      address,
      status,
    } = parsed.data;

    const party = await prisma.party.update({
      where: { id },
      data: {
        displayName,
        economicCode,
        nationalId,
        registrationNo,
        taxId,
        phone,
        email,
        address,
        ...(!isCustomerUser(auth.user) && status && { status }),
      },
    });

    return apiJson(party);
  } catch (error) {
    return handleRouteError(request, error, "update party");
  }
}
