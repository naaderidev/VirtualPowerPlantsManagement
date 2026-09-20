import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRepresentationState, representationPeriodsMatch } from "@/domain/parties";
import { REPRESENTATIVE_MANAGE_ROLES } from "@/lib/access-control";
import {
  createRepresentativeAssignmentSchema,
  representativeListQuerySchema,
} from "@/lib/api-schemas";
import {
  BusinessRuleError,
  handleRouteError,
  parseJsonBody,
  parseSearchParams,
} from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { formatApiDate } from "@/lib/persian-date";

const farFuture = new Date("9999-12-31T23:59:59.999Z");

function stateFilter(
  state: "ALL" | "CURRENT" | "SCHEDULED" | "EXPIRED" | "REVOKED",
  now: Date
): Prisma.RelationshipWhereInput {
  if (state === "CURRENT") {
    return {
      active: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    };
  }
  if (state === "SCHEDULED") return { active: true, validFrom: { gt: now } };
  if (state === "EXPIRED") return { active: true, validTo: { lt: now } };
  if (state === "REVOKED") return { active: false };
  return {};
}

function representativeUserIdFromMetadata(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata.representativeUserId;
  return typeof value === "string" ? value : null;
}

function hasOverlappingPeriodWhere(
  validFrom: Date,
  validTo: Date | null | undefined
): Prisma.RelationshipWhereInput {
  return {
    validFrom: { lte: validTo ?? farFuture },
    OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(REPRESENTATIVE_MANAGE_ROLES);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, representativeListQuerySchema);
    if (!query.ok) return query.response;
    const { page, limit, state } = query.data;
    const now = new Date();
    const where: Prisma.RelationshipWhereInput = {
      type: "REPRESENTATIVE",
      ...stateFilter(state, now),
    };

    const [relationships, total, representativeUsers, companies] = await Promise.all([
      prisma.relationship.findMany({
        where,
        include: {
          fromEntity: {
            select: {
              id: true,
              displayName: true,
              users: {
                where: { role: "CUSTOMER_REPRESENTATIVE" },
                select: { id: true, name: true, mobile: true, active: true },
              },
            },
          },
          toEntity: { select: { id: true, displayName: true, status: true } },
          createdBy: { select: { id: true, name: true } },
          revokedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.relationship.count({ where }),
      prisma.user.findMany({
        where: { role: "CUSTOMER_REPRESENTATIVE", active: true },
        select: {
          id: true,
          name: true,
          mobile: true,
          partyId: true,
          party: { select: { id: true, displayName: true, status: true } },
        },
        orderBy: { name: "asc" },
        take: 100,
      }),
      prisma.party.findMany({
        where: { type: "COMPANY", status: "ACTIVE" },
        select: { id: true, displayName: true, nationalId: true },
        orderBy: { displayName: "asc" },
        take: 100,
      }),
    ]);

    const partyPairs = relationships.map(({ fromEntityId, toEntityId }) => ({
      fromEntityId,
      toEntityId,
    }));
    const signatoryRelationships = partyPairs.length
      ? await prisma.relationship.findMany({
          where: {
            type: "AUTHORIZED_SIGNATORY",
            OR: partyPairs,
          },
          select: {
            id: true,
            fromEntityId: true,
            toEntityId: true,
            active: true,
            validFrom: true,
            validTo: true,
          },
        })
      : [];

    const assignments = relationships.map((relationship) => {
      const representativeUserId = representativeUserIdFromMetadata(relationship.metadata);
      const representativeUser =
        relationship.fromEntity.users.find(({ id }) => id === representativeUserId) ??
        relationship.fromEntity.users[0] ??
        null;
      const signatoryRelationship = signatoryRelationships.find(
        (candidate) =>
          candidate.fromEntityId === relationship.fromEntityId &&
          candidate.toEntityId === relationship.toEntityId &&
          representationPeriodsMatch(candidate, relationship)
      );

      return {
        id: relationship.id,
        representativeUser,
        representativeParty: {
          id: relationship.fromEntity.id,
          displayName: relationship.fromEntity.displayName,
        },
        company: relationship.toEntity,
        state: getRepresentationState(relationship, now),
        active: relationship.active,
        validFrom: relationship.validFrom,
        validTo: relationship.validTo,
        canSign: signatoryRelationship?.active ?? false,
        authorityReference: relationship.authorityReference,
        notes: relationship.notes,
        createdBy: relationship.createdBy,
        revokedBy: relationship.revokedBy,
        revokedAt: relationship.revokedAt,
        createdAt: relationship.createdAt,
      };
    });

    return apiJson({
      assignments,
      options: { representativeUsers, companies },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch representative assignments");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(REPRESENTATIVE_MANAGE_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createRepresentativeAssignmentSchema);
    if (!parsed.ok) return parsed.response;
    const {
      representativeUserId,
      companyPartyId,
      validFrom,
      validTo,
      canSign,
      authorityReference,
      notes,
    } = parsed.data;
    const audit = getAuditMetadata(request, parsed.correlationId);

    const result = await prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: representativeUserId },
          include: { party: true },
        });
        if (!user || !user.active || user.role !== "CUSTOMER_REPRESENTATIVE") {
          throw new BusinessRuleError("حساب نماینده فعال پیدا نشد.", "NOT_FOUND", 404);
        }

        const company = await transaction.party.findFirst({
          where: { id: companyPartyId, type: "COMPANY", status: "ACTIVE" },
          select: { id: true, displayName: true },
        });
        if (!company) {
          throw new BusinessRuleError("شرکت فعال پیدا نشد.", "NOT_FOUND", 404);
        }

        let representativeParty = user.party;
        if (!representativeParty) {
          representativeParty = await transaction.party.upsert({
            where: { systemCode: `REPRESENTATIVE_USER_${user.id}` },
            update: {},
            create: {
              systemCode: `REPRESENTATIVE_USER_${user.id}`,
              type: "PERSON",
              displayName: user.name,
              phone: user.mobile,
              email: user.email,
            },
          });
          await transaction.user.update({
            where: { id: user.id },
            data: { partyId: representativeParty.id },
          });
        }
        if (representativeParty.type !== "PERSON" || representativeParty.status !== "ACTIVE") {
          throw new BusinessRuleError("طرف متصل به حساب نماینده باید شخص حقیقی فعال باشد.");
        }
        if (representativeParty.id === company.id) {
          throw new BusinessRuleError("نماینده و شرکت نمی‌توانند یک طرف باشند.");
        }

        const overlap = await transaction.relationship.findFirst({
          where: {
            fromEntityId: representativeParty.id,
            toEntityId: company.id,
            type: "REPRESENTATIVE",
            active: true,
            ...hasOverlappingPeriodWhere(validFrom, validTo),
          },
          select: { id: true },
        });
        if (overlap) {
          throw new BusinessRuleError(
            "برای این نماینده و شرکت، بازه نمایندگی هم‌پوشان وجود دارد.",
            "CONFLICT",
            409
          );
        }

        const metadata = { representativeUserId: user.id } satisfies Prisma.InputJsonObject;
        const relationship = await transaction.relationship.create({
          data: {
            fromEntityId: representativeParty.id,
            toEntityId: company.id,
            type: "REPRESENTATIVE",
            validFrom,
            validTo,
            authorityReference,
            notes,
            metadata,
            createdById: auth.user.id,
          },
        });
        if (canSign) {
          await transaction.relationship.create({
            data: {
              fromEntityId: representativeParty.id,
              toEntityId: company.id,
              type: "AUTHORIZED_SIGNATORY",
              validFrom,
              validTo,
              authorityReference,
              notes,
              metadata,
              createdById: auth.user.id,
            },
          });
        }

        await transaction.auditLog.create({
          data: {
            entityType: "Relationship",
            entityId: relationship.id,
            action: "CREATE_REPRESENTATION",
            userId: auth.user.id,
            changes: {
              representativeUserId: user.id,
              representativePartyId: representativeParty.id,
              companyPartyId: company.id,
              validFrom: formatApiDate(validFrom, "validFrom"),
              validTo: validTo ? formatApiDate(validTo, "validTo") : null,
              canSign,
              authorityReference: authorityReference ?? null,
            },
            ...audit,
          },
        });
        await transaction.notification.create({
          data: {
            userId: user.id,
            partyId: representativeParty.id,
            title: "نمایندگی شرکت ثبت شد",
            message: `دسترسی نمایندگی شما برای ${company.displayName} ثبت شد.`,
            type: "ALERT",
            link: "/customer/dashboard",
          },
        });

        return { id: relationship.id, canSign };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return apiJson(result, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create representative assignment");
  }
}
