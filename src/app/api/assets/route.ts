import { apiJson } from "@/lib/api-response";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  INTERNAL_ROLES,
  TECHNICAL_ROLES,
  canAccessParty,
  isCustomerUser,
} from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createAssetSchema, assetListQuerySchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";

// GET /api/assets - Get all assets
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, assetListQuerySchema);
    if (!query.ok) return query.response;
    const { type, status, ownerId, archiveState, page, limit } = query.data;

    const where: Prisma.AssetWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (archiveState === "CURRENT") where.archivedAt = null;
    if (archiveState === "ARCHIVED") where.archivedAt = { not: null };
    if (isCustomerUser(auth.user)) {
      where.ownerId = { in: auth.user.accessiblePartyIds };
    } else if (ownerId) {
      where.ownerId = ownerId;
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
            },
          },
          requests: {
            select: { id: true, caseNumber: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              meters: true,
              requests: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return apiJson({
      assets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch assets");
  }
}

// POST /api/assets - Create a new asset
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser([...TECHNICAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createAssetSchema);
    if (!parsed.ok) return parsed.response;
    const {
      ownerId,
      name,
      type,
      province,
      city,
      address,
      latitude,
      longitude,
      gridCompany,
      connectionPoint,
      connectionStatus,
      capacityNominal,
      capacitySellable,
      technology,
      operationalDate,
      connectionDate,
    } = parsed.data;

    const effectiveOwnerId = isCustomerUser(auth.user) ? auth.user.actingPartyId : ownerId;
    if (!effectiveOwnerId) {
      return apiError(422, "VALIDATION_ERROR", "انتخاب مالک الزامی است.", {
        request,
        details: { ownerId: ["انتخاب مالک الزامی است."] },
      });
    }
    if (isCustomerUser(auth.user) && !canAccessParty(auth.user, effectiveOwnerId)) {
      return apiError(403, "FORBIDDEN", "اجازه ثبت دارایی برای این طرف را ندارید.", { request });
    }

    const ownerExists = await prisma.party.findUnique({
      where: { id: effectiveOwnerId },
      select: { id: true },
    });
    if (!ownerExists) {
      return apiError(422, "VALIDATION_ERROR", "مالک انتخاب‌شده وجود ندارد.", {
        request,
        details: { ownerId: ["مالک انتخاب‌شده وجود ندارد."] },
      });
    }

    const asset = await prisma.asset.create({
      data: {
        ownerId: effectiveOwnerId,
        name,
        type,
        province,
        city,
        address,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        gridCompany,
        connectionPoint,
        connectionStatus,
        capacityNominal,
        capacitySellable: capacitySellable ?? capacityNominal,
        technology,
        operationalDate: operationalDate ?? null,
        connectionDate: connectionDate ?? null,
      },
      include: {
        owner: true,
      },
    });

    return apiJson(asset, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create asset");
  }
}
