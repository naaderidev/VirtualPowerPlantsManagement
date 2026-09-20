import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, PROPOSAL_MANAGE_ROLES, canAccessParty, isCustomerUser } from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { reviewProposalSchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody, requireExistingRecord } from "@/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...PROPOSAL_MANAGE_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            party: true,
            asset: true,
          },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!proposal) {
      return apiError(404, "NOT_FOUND", "پیشنهاد پیدا نشد.", { request });
    }

    if (
      isCustomerUser(auth.user) &&
      !canAccessParty(auth.user, proposal.request.partyId)
    ) {
      return forbiddenResponse();
    }

    return apiJson(proposal);
  } catch (error) {
    return handleRouteError(request, error, "fetch proposal");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, reviewProposalSchema);
    if (!parsed.ok) return parsed.response;
    const { notes, action } = parsed.data;

    const auth = await requireApiUser(PROPOSAL_MANAGE_ROLES);
    if (!auth.ok) return auth.response;
    const reviewerId = auth.user.id;

    await requireExistingRecord(
      prisma.proposal.findUnique({ where: { id }, select: { id: true } }),
      "پیشنهاد پیدا نشد."
    );
    await prisma.proposalReview.create({
      data: { proposalId: id, reviewerId, action, notes },
    });

    return apiJson({ success: true });
  } catch (error) {
    return handleRouteError(request, error, "review proposal");
  }
}
