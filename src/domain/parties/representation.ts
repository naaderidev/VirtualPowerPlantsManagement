export type RepresentationState = "CURRENT" | "SCHEDULED" | "EXPIRED" | "REVOKED";

export const ACTING_PARTY_COOKIE = "vpp-acting-party";

export type ActingPartyKind = "PERSONAL" | "REPRESENTED";

export type ActingPartyOption = {
  id: string;
  displayName: string;
  kind: ActingPartyKind;
};

export type RepresentationPeriod = {
  validFrom: Date;
  validTo?: Date | null;
};

export function getRepresentationState(
  relationship: RepresentationPeriod & { active: boolean },
  at: Date
): RepresentationState {
  if (!relationship.active) return "REVOKED";
  if (relationship.validFrom > at) return "SCHEDULED";
  if (relationship.validTo && relationship.validTo < at) return "EXPIRED";
  return "CURRENT";
}

export function representationPeriodsOverlap(
  left: RepresentationPeriod,
  right: RepresentationPeriod
): boolean {
  const leftEnd = left.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.validFrom.getTime() <= rightEnd && right.validFrom.getTime() <= leftEnd;
}

export function representationPeriodsMatch(
  left: RepresentationPeriod,
  right: RepresentationPeriod
): boolean {
  return (
    left.validFrom.getTime() === right.validFrom.getTime() &&
    (left.validTo?.getTime() ?? null) === (right.validTo?.getTime() ?? null)
  );
}

export function resolveActingPartyId(
  role: "CUSTOMER" | "CUSTOMER_REPRESENTATIVE" | "INTERNAL",
  ownPartyId: string | null,
  representedPartyIds: readonly string[],
  selectedPartyId: string | null
): string | null {
  if (role === "CUSTOMER") return ownPartyId;
  if (role === "CUSTOMER_REPRESENTATIVE") {
    const selectablePartyIds = ownPartyId
      ? [ownPartyId, ...representedPartyIds]
      : representedPartyIds;
    return selectedPartyId && selectablePartyIds.includes(selectedPartyId)
      ? selectedPartyId
      : null;
  }
  return null;
}

export function serializeActingPartySelection(
  loginSessionId: string,
  partyId: string
): string {
  return `${loginSessionId}:${partyId}`;
}

export function parseActingPartySelection(
  cookieValue: string | null,
  loginSessionId: string
): string | null {
  if (!cookieValue) return null;
  const separatorIndex = cookieValue.indexOf(":");
  if (separatorIndex < 1) return null;

  const cookieSessionId = cookieValue.slice(0, separatorIndex);
  const partyId = cookieValue.slice(separatorIndex + 1);
  return cookieSessionId === loginSessionId && partyId ? partyId : null;
}
