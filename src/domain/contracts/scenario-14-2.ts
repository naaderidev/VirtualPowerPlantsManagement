export type Scenario142PricingModel = "FIXED" | "MARKET_INDEX" | "OTHER";

export type Scenario142RelationshipType =
  | "REPRESENTATIVE"
  | "AUTHORIZED_SIGNATORY";

export type RepresentationGrant = {
  representativePartyId: string;
  companyPartyId: string;
  type: Scenario142RelationshipType;
  validFrom: Date;
  validTo?: Date | null;
};

export type Scenario142ContractAsset = {
  assetId: string;
  ownerPartyId: string;
  pricingModel: Scenario142PricingModel;
  scheduleCount: number;
};

export type Scenario142MasterAgreement = {
  sellerPartyId: string;
  assets: readonly Scenario142ContractAsset[];
};

export type Scenario142Settlement = {
  settlementId: string;
  assetId: string;
  partyId: string;
  status: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  alreadyNetted: boolean;
};

export type Scenario142NettingApproval = {
  financialApprovedBy?: string | null;
  legalApprovedBy?: string | null;
};

export type Scenario142Violation =
  | "REPRESENTATION_NOT_ACTIVE"
  | "SIGNATORY_AUTHORITY_REQUIRED"
  | "EXACTLY_TWO_ASSETS_REQUIRED"
  | "DUPLICATE_ASSET"
  | "ASSET_OWNER_MISMATCH"
  | "ONE_SCHEDULE_PER_ASSET_REQUIRED"
  | "FIXED_AND_MARKET_SCHEDULES_REQUIRED"
  | "PRICING_ORDER_REQUIRED"
  | "AT_LEAST_TWO_SETTLEMENTS_REQUIRED"
  | "DUPLICATE_SETTLEMENT"
  | "SETTLEMENT_NOT_CONFIRMED"
  | "SETTLEMENT_PARTY_MISMATCH"
  | "SETTLEMENT_PERIOD_MISMATCH"
  | "SETTLEMENT_CURRENCY_MISMATCH"
  | "DISTINCT_ASSETS_REQUIRED"
  | "SETTLEMENT_ALREADY_NETTED"
  | "FINANCIAL_APPROVAL_REQUIRED"
  | "LEGAL_APPROVAL_REQUIRED"
  | "SEPARATE_APPROVERS_REQUIRED";

export function canCreateScenario142MasterAgreement(
  partyType: string,
  eligibleRequestCount: number,
): boolean {
  return partyType === "COMPANY" && eligibleRequestCount >= 2;
}

function isGrantActive(grant: RepresentationGrant, at: Date): boolean {
  return grant.validFrom <= at && (!grant.validTo || grant.validTo >= at);
}

function hasActiveGrant(
  grants: readonly RepresentationGrant[],
  representativePartyId: string,
  companyPartyId: string,
  type: Scenario142RelationshipType,
  at: Date
): boolean {
  return grants.some(
    (grant) =>
      grant.representativePartyId === representativePartyId &&
      grant.companyPartyId === companyPartyId &&
      grant.type === type &&
      isGrantActive(grant, at)
  );
}

export function canActForScenario142Company(
  grants: readonly RepresentationGrant[],
  representativePartyId: string,
  companyPartyId: string,
  at: Date
): boolean {
  return hasActiveGrant(
    grants,
    representativePartyId,
    companyPartyId,
    "REPRESENTATIVE",
    at
  );
}

export function canSignForScenario142Company(
  grants: readonly RepresentationGrant[],
  representativePartyId: string,
  companyPartyId: string,
  at: Date
): boolean {
  return hasActiveGrant(
    grants,
    representativePartyId,
    companyPartyId,
    "AUTHORIZED_SIGNATORY",
    at
  );
}

export function validateScenario142MasterAgreement(
  agreement: Scenario142MasterAgreement
): Scenario142Violation[] {
  const violations = new Set<Scenario142Violation>();
  const assetIds = agreement.assets.map(({ assetId }) => assetId);
  const pricingModels = agreement.assets.map(({ pricingModel }) => pricingModel);

  if (agreement.assets.length !== 2) {
    violations.add("EXACTLY_TWO_ASSETS_REQUIRED");
  }
  if (new Set(assetIds).size !== assetIds.length) {
    violations.add("DUPLICATE_ASSET");
  }
  if (agreement.assets.some(({ ownerPartyId }) => ownerPartyId !== agreement.sellerPartyId)) {
    violations.add("ASSET_OWNER_MISMATCH");
  }
  if (agreement.assets.some(({ scheduleCount }) => scheduleCount !== 1)) {
    violations.add("ONE_SCHEDULE_PER_ASSET_REQUIRED");
  }
  if (
    pricingModels.filter((model) => model === "FIXED").length !== 1 ||
    pricingModels.filter((model) => model === "MARKET_INDEX").length !== 1
  ) {
    violations.add("FIXED_AND_MARKET_SCHEDULES_REQUIRED");
  }
  if (
    agreement.assets.length === 2 &&
    (agreement.assets[0].pricingModel !== "FIXED" ||
      agreement.assets[1].pricingModel !== "MARKET_INDEX")
  ) {
    violations.add("PRICING_ORDER_REQUIRED");
  }

  return [...violations];
}

function datesMatch(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

export function validateScenario142Netting(
  settlements: readonly Scenario142Settlement[],
  companyPartyId: string,
  approval: Scenario142NettingApproval
): Scenario142Violation[] {
  const violations = new Set<Scenario142Violation>();

  if (settlements.length < 2) {
    violations.add("AT_LEAST_TWO_SETTLEMENTS_REQUIRED");
  }

  const settlementIds = settlements.map(({ settlementId }) => settlementId);
  if (new Set(settlementIds).size !== settlementIds.length) {
    violations.add("DUPLICATE_SETTLEMENT");
  }
  if (settlements.some(({ status }) => status !== "CONFIRMED")) {
    violations.add("SETTLEMENT_NOT_CONFIRMED");
  }
  if (settlements.some(({ partyId }) => partyId !== companyPartyId)) {
    violations.add("SETTLEMENT_PARTY_MISMATCH");
  }
  if (settlements.some(({ alreadyNetted }) => alreadyNetted)) {
    violations.add("SETTLEMENT_ALREADY_NETTED");
  }

  const [firstSettlement] = settlements;
  if (firstSettlement) {
    if (
      settlements.some(
        ({ periodStart, periodEnd }) =>
          !datesMatch(periodStart, firstSettlement.periodStart) ||
          !datesMatch(periodEnd, firstSettlement.periodEnd)
      )
    ) {
      violations.add("SETTLEMENT_PERIOD_MISMATCH");
    }
    if (settlements.some(({ currency }) => currency !== firstSettlement.currency)) {
      violations.add("SETTLEMENT_CURRENCY_MISMATCH");
    }
  }

  const assetIds = settlements.map(({ assetId }) => assetId);
  if (new Set(assetIds).size < 2) {
    violations.add("DISTINCT_ASSETS_REQUIRED");
  }
  if (!approval.financialApprovedBy) {
    violations.add("FINANCIAL_APPROVAL_REQUIRED");
  }
  if (!approval.legalApprovedBy) {
    violations.add("LEGAL_APPROVAL_REQUIRED");
  }
  if (
    approval.financialApprovedBy &&
    approval.legalApprovedBy &&
    approval.financialApprovedBy === approval.legalApprovedBy
  ) {
    violations.add("SEPARATE_APPROVERS_REQUIRED");
  }

  return [...violations];
}
