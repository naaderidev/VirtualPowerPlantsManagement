export const APP_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "STAFF_FINANCIAL",
  "MANAGER",
  "CUSTOMER",
  "CUSTOMER_REPRESENTATIVE",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const INTERNAL_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "STAFF_FINANCIAL",
  "MANAGER",
] as const satisfies readonly AppRole[];

export const CUSTOMER_ROLES = [
  "CUSTOMER",
  "CUSTOMER_REPRESENTATIVE",
] as const satisfies readonly AppRole[];

export const SUPPLY_ROLES = ["ADMIN", "STAFF_SUPPLY"] as const satisfies readonly AppRole[];
export const TECHNICAL_ROLES = ["ADMIN", "STAFF_SUPPLY", "STAFF_TECHNICAL"] as const satisfies readonly AppRole[];
export const METER_READING_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_FINANCIAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const CONTRACT_WRITE_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_LEGAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const REQUEST_WRITE_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const FINANCIAL_ROLES = [
  "ADMIN",
  "STAFF_FINANCIAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const NETTING_READ_ROLES = [
  "ADMIN",
  "STAFF_FINANCIAL",
  "STAFF_LEGAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const NETTING_CREATE_ROLES = [
  "ADMIN",
  "STAFF_FINANCIAL",
] as const satisfies readonly AppRole[];
export const SETTLEMENT_CALCULATION_ROLES = ["ADMIN"] as const satisfies readonly AppRole[];
export const PRICING_USE_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_FINANCIAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const PROPOSAL_MANAGE_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const PARTY_WRITE_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_LEGAL",
  "MANAGER",
] as const satisfies readonly AppRole[];
export const REPRESENTATIVE_MANAGE_ROLES = ["ADMIN"] as const satisfies readonly AppRole[];
export const PAYMENT_READ_ROLES = [
  "ADMIN",
  "STAFF_FINANCIAL",
  "MANAGER",
  ...CUSTOMER_ROLES,
] as const satisfies readonly AppRole[];
export const PAYMENT_WRITE_ROLES = ["ADMIN", "STAFF_FINANCIAL"] as const satisfies readonly AppRole[];
export const CONTRACT_SIGN_ROLES = [
  "ADMIN",
  "STAFF_LEGAL",
  "MANAGER",
  ...CUSTOMER_ROLES,
] as const satisfies readonly AppRole[];
export const AUDIT_READ_ROLES = ["ADMIN", "MANAGER"] as const satisfies readonly AppRole[];
export const DOCUMENT_ACCESS_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "MANAGER",
  "CUSTOMER",
  "CUSTOMER_REPRESENTATIVE",
] as const satisfies readonly AppRole[];
export const DOCUMENT_VERIFY_ROLES = [
  "ADMIN",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
] as const satisfies readonly AppRole[];

export type AccessUser = {
  id: string;
  role: AppRole;
  partyId: string | null;
  accessiblePartyIds?: readonly string[];
  authorizedSignatoryPartyIds?: readonly string[];
  actingPartyId?: string | null;
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function hasAnyRole(user: AccessUser, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(user.role);
}

export function roleIsAllowed(role: AppRole, allowedRoles: readonly AppRole[]): boolean {
  return allowedRoles.includes(role);
}

export function isInternalUser(user: AccessUser): boolean {
  return hasAnyRole(user, INTERNAL_ROLES);
}

export function isCustomerUser(user: AccessUser): boolean {
  return hasAnyRole(user, CUSTOMER_ROLES);
}

export function canAccessParty(user: AccessUser, partyId: string): boolean {
  if (isInternalUser(user)) return true;
  if (user.role === "CUSTOMER_REPRESENTATIVE") {
    return user.actingPartyId === partyId && (user.accessiblePartyIds?.includes(partyId) ?? false);
  }
  return user.partyId === partyId;
}

export function canSignForParty(user: AccessUser, partyId: string): boolean {
  if (isInternalUser(user)) return true;
  if (user.role === "CUSTOMER_REPRESENTATIVE") {
    return (
      user.actingPartyId === partyId &&
      (user.authorizedSignatoryPartyIds?.includes(partyId) ?? false)
    );
  }
  return user.partyId === partyId;
}

export function requireOwnPartyId(user: AccessUser): string | null {
  if (!isCustomerUser(user)) return null;
  return user.actingPartyId ?? null;
}
