import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { REPRESENTATIVE_MANAGE_ROLES } from "@/lib/access-control";
import { updateRepresentativeAssignmentSchema } from "@/lib/api-schemas";
import {
  BusinessRuleError,
  getCorrelationId,
  handleRouteError,
  parseJsonBody,
} from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { formatApiDate } from "@/lib/persian-date";

const farFuture = new Date("9999-12-31T23:59:59.999Z");

function pairedSignatoryWhere(relationship: {
  fromEntityId: string;
  toEntityId: string;
  validFrom: Date;
  validTo: Date | null;
}): Prisma.RelationshipWhereInput {
  return {
    fromEntityId: relationship.fromEntityId,
    toEntityId: relationship.toEntityId,
    type: "AUTHORIZED_SIGNATORY",
    validFrom: relationship.validFrom,
    validTo: relationship.validTo,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(REPRESENTATIVE_MANAGE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, updateRepresentativeAssignmentSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const { validFrom, validTo, canSign, authorityReference, notes } = parsed.data;
    const audit = getAuditMetadata(request, parsed.correlationId);

    const result = await prisma.$transaction(
      async (transaction) => {
        const relationship = await transaction.relationship.findFirst({
          where: { id, type: "REPRESENTATIVE" },
          include: {
            fromEntity: {
              select: {
                users: {
                  where: { role: "CUSTOMER_REPRESENTATIVE" },
                  select: { id: true, partyId: true },
                },
              },
            },
            toEntity: { select: { displayName: true } },
          },
        });
        if (!relationship) {
          throw new BusinessRuleError("نمایندگی پیدا نشد.", "NOT_FOUND", 404);
        }
        if (!relationship.active) {
          throw new BusinessRuleError("نمایندگی لغوشده قابل ویرایش نیست.", "CONFLICT", 409);
        }

        const overlap = await transaction.relationship.findFirst({
          where: {
            id: { not: relationship.id },
            fromEntityId: relationship.fromEntityId,
            toEntityId: relationship.toEntityId,
            type: "REPRESENTATIVE",
            active: true,
            validFrom: { lte: validTo ?? farFuture },
            OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
          },
          select: { id: true },
        });
        if (overlap) {
          throw new BusinessRuleError(
            "بازه جدید با نمایندگی فعال دیگری هم‌پوشانی دارد.",
            "CONFLICT",
            409
          );
        }

        const signatory = await transaction.relationship.findFirst({
          where: pairedSignatoryWhere(relationship),
        });
        const updated = await transaction.relationship.update({
          where: { id: relationship.id },
          data: { validFrom, validTo, authorityReference, notes },
        });

        if (canSign && signatory) {
          await transaction.relationship.update({
            where: { id: signatory.id },
            data: {
              active: true,
              validFrom,
              validTo,
              authorityReference,
              notes,
              revokedAt: null,
              revokedById: null,
            },
          });
        } else if (canSign) {
          await transaction.relationship.create({
            data: {
              fromEntityId: relationship.fromEntityId,
              toEntityId: relationship.toEntityId,
              type: "AUTHORIZED_SIGNATORY",
              validFrom,
              validTo,
              authorityReference,
              notes,
              metadata: relationship.metadata ?? undefined,
              createdById: auth.user.id,
            },
          });
        } else if (signatory?.active) {
          await transaction.relationship.update({
            where: { id: signatory.id },
            data: { active: false, revokedAt: new Date(), revokedById: auth.user.id },
          });
        }

        const representativeUser = relationship.fromEntity.users[0] ?? null;
        await transaction.auditLog.create({
          data: {
            entityType: "Relationship",
            entityId: relationship.id,
            action: "UPDATE_REPRESENTATION",
            userId: auth.user.id,
            changes: {
              previous: {
                validFrom: formatApiDate(relationship.validFrom, "validFrom"),
                validTo: relationship.validTo ? formatApiDate(relationship.validTo, "validTo") : null,
                authorityReference: relationship.authorityReference,
                notes: relationship.notes,
                canSign: signatory?.active ?? false,
              },
              next: {
                validFrom: formatApiDate(validFrom, "validFrom"),
                validTo: validTo ? formatApiDate(validTo, "validTo") : null,
                authorityReference: authorityReference ?? null,
                notes: notes ?? null,
                canSign,
              },
            },
            ...audit,
          },
        });
        if (representativeUser) {
          await transaction.notification.create({
            data: {
              userId: representativeUser.id,
              partyId: representativeUser.partyId,
              title: "دسترسی نمایندگی به‌روزرسانی شد",
              message: `دسترسی شما برای ${relationship.toEntity.displayName} تغییر کرد.`,
              type: "ALERT",
              link: "/customer/dashboard",
            },
          });
        }

        return { id: updated.id, canSign };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return apiJson(result);
  } catch (error) {
    return handleRouteError(request, error, "update representative assignment");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(REPRESENTATIVE_MANAGE_ROLES);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const correlationId = getCorrelationId(request);
    const audit = getAuditMetadata(request, correlationId);

    const result = await prisma.$transaction(
      async (transaction) => {
        const relationship = await transaction.relationship.findFirst({
          where: { id, type: "REPRESENTATIVE" },
          include: {
            fromEntity: {
              select: {
                users: {
                  where: { role: "CUSTOMER_REPRESENTATIVE" },
                  select: { id: true, partyId: true },
                },
              },
            },
            toEntity: { select: { displayName: true } },
          },
        });
        if (!relationship) {
          throw new BusinessRuleError("نمایندگی پیدا نشد.", "NOT_FOUND", 404);
        }
        if (!relationship.active) return { id: relationship.id, active: false };

        const revokedAt = new Date();
        await transaction.relationship.update({
          where: { id: relationship.id },
          data: { active: false, revokedAt, revokedById: auth.user.id },
        });
        await transaction.relationship.updateMany({
          where: { ...pairedSignatoryWhere(relationship), active: true },
          data: { active: false, revokedAt, revokedById: auth.user.id },
        });
        await transaction.auditLog.create({
          data: {
            entityType: "Relationship",
            entityId: relationship.id,
            action: "REVOKE_REPRESENTATION",
            userId: auth.user.id,
            changes: { active: { from: true, to: false }, revokedAt: formatApiDate(revokedAt) },
            ...audit,
          },
        });
        const representativeUser = relationship.fromEntity.users[0] ?? null;
        if (representativeUser) {
          await transaction.notification.create({
            data: {
              userId: representativeUser.id,
              partyId: representativeUser.partyId,
              title: "نمایندگی شرکت لغو شد",
              message: `دسترسی نمایندگی شما برای ${relationship.toEntity.displayName} لغو شد.`,
              type: "ALERT",
              link: "/customer/dashboard",
            },
          });
        }

        return { id: relationship.id, active: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return apiJson(result, {
      headers: { "x-correlation-id": correlationId },
    });
  } catch (error) {
    return handleRouteError(request, error, "revoke representative assignment");
  }
}
