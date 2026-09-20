// VPP — Party Domain Types

export * from "./representation";

export type PartyType = "PERSON" | "COMPANY";

export type PartyStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type UserRole =
  | "ADMIN"
  | "STAFF_SUPPLY"
  | "STAFF_TECHNICAL"
  | "STAFF_LEGAL"
  | "STAFF_FINANCIAL"
  | "MANAGER"
  | "CUSTOMER"
  | "CUSTOMER_REPRESENTATIVE";

export type RelationType =
  | "SELLER"
  | "BUYER"
  | "INSTALLER"
  | "CONTRACTOR"
  | "CONSULTANT"
  | "MAINTAINER";

export type RelationshipType =
  | "REPRESENTATIVE"
  | "EMPLOYEE"
  | "PARTNER"
  | "AUTHORIZED_SIGNATORY";

export interface Party {
  id: string;
  type: PartyType;
  displayName: string;
  economicCode?: string | null;
  nationalId?: string | null;
  registrationNo?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: PartyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  partyId?: string | null;
  party?: Party | null;
  name: string;
  mobile: string;
  email?: string | null;
  password?: string | null;
  role: UserRole;
  active: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
}

export interface BusinessRelation {
  id: string;
  partyId: string;
  party: Party;
  type: RelationType;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  createdAt: Date;
}

export interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationshipType;
  active: boolean;
  validFrom: Date;
  validTo?: Date | null;
  authorityReference?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdById?: string | null;
  revokedById?: string | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
