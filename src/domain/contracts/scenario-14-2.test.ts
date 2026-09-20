import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateScenario142MasterAgreement,
  canActForScenario142Company,
  canSignForScenario142Company,
  validateScenario142MasterAgreement,
  validateScenario142Netting,
  type RepresentationGrant,
  type Scenario142Settlement,
} from "./scenario-14-2";

test("offers a master agreement only to a company with at least two eligible requests", () => {
  assert.equal(canCreateScenario142MasterAgreement("COMPANY", 1), false);
  assert.equal(canCreateScenario142MasterAgreement("COMPANY", 2), true);
  assert.equal(canCreateScenario142MasterAgreement("PERSON", 2), false);
});

const now = new Date("2026-09-14T00:00:00.000Z");

const grants: RepresentationGrant[] = [
  {
    representativePartyId: "representative",
    companyPartyId: "company",
    type: "REPRESENTATIVE",
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    representativePartyId: "representative",
    companyPartyId: "company",
    type: "AUTHORIZED_SIGNATORY",
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
];

test("keeps company representation separate from contract-signing authority", () => {
  assert.equal(canActForScenario142Company(grants, "representative", "company", now), true);
  assert.equal(canSignForScenario142Company(grants, "representative", "company", now), true);
  assert.equal(canSignForScenario142Company(grants.slice(0, 1), "representative", "company", now), false);
});

test("rejects expired representation grants", () => {
  const expiredGrant: RepresentationGrant = {
    ...grants[0],
    validTo: new Date("2026-09-13T23:59:59.000Z"),
  };

  assert.equal(
    canActForScenario142Company([expiredGrant], "representative", "company", now),
    false
  );
});

test("accepts one master agreement with two company assets and independent pricing schedules", () => {
  assert.deepEqual(
    validateScenario142MasterAgreement({
      sellerPartyId: "company",
      assets: [
        {
          assetId: "plant-fixed",
          ownerPartyId: "company",
          pricingModel: "FIXED",
          scheduleCount: 1,
        },
        {
          assetId: "plant-market",
          ownerPartyId: "company",
          pricingModel: "MARKET_INDEX",
          scheduleCount: 1,
        },
      ],
    }),
    []
  );
});

test("reports invalid master-agreement composition", () => {
  const violations = validateScenario142MasterAgreement({
    sellerPartyId: "company",
    assets: [
      {
        assetId: "plant-fixed",
        ownerPartyId: "another-company",
        pricingModel: "FIXED",
        scheduleCount: 2,
      },
    ],
  });

  assert.deepEqual(
    new Set(violations),
    new Set([
      "EXACTLY_TWO_ASSETS_REQUIRED",
      "ASSET_OWNER_MISMATCH",
      "ONE_SCHEDULE_PER_ASSET_REQUIRED",
      "FIXED_AND_MARKET_SCHEDULES_REQUIRED",
    ])
  );
});

test("keeps the first plant fixed and the second plant market-indexed", () => {
  const violations = validateScenario142MasterAgreement({
    sellerPartyId: "company",
    assets: [
      {
        assetId: "plant-first",
        ownerPartyId: "company",
        pricingModel: "MARKET_INDEX",
        scheduleCount: 1,
      },
      {
        assetId: "plant-second",
        ownerPartyId: "company",
        pricingModel: "FIXED",
        scheduleCount: 1,
      },
    ],
  });

  assert.ok(violations.includes("PRICING_ORDER_REQUIRED"));
});

const confirmedSettlements: Scenario142Settlement[] = [
  {
    settlementId: "settlement-fixed",
    assetId: "plant-fixed",
    partyId: "company",
    status: "CONFIRMED",
    currency: "IRR",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    alreadyNetted: false,
  },
  {
    settlementId: "settlement-market",
    assetId: "plant-market",
    partyId: "company",
    status: "CONFIRMED",
    currency: "IRR",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    alreadyNetted: false,
  },
];

test("allows netting only after separate financial and legal approvals", () => {
  assert.deepEqual(
    validateScenario142Netting(confirmedSettlements, "company", {
      financialApprovedBy: "financial-user",
      legalApprovedBy: "legal-user",
    }),
    []
  );
});

test("rejects unconfirmed, cross-party, reused, or unapproved netting inputs", () => {
  const invalidSettlements: Scenario142Settlement[] = [
    { ...confirmedSettlements[0], status: "UNDER_REVIEW", alreadyNetted: true },
    {
      ...confirmedSettlements[1],
      partyId: "another-company",
      currency: "USD",
      periodStart: new Date("2026-09-01T00:00:00.000Z"),
      periodEnd: new Date("2026-09-30T23:59:59.999Z"),
    },
  ];

  const violations = validateScenario142Netting(invalidSettlements, "company", {
    financialApprovedBy: "same-user",
    legalApprovedBy: "same-user",
  });

  assert.deepEqual(
    new Set(violations),
    new Set([
      "SETTLEMENT_NOT_CONFIRMED",
      "SETTLEMENT_PARTY_MISMATCH",
      "SETTLEMENT_PERIOD_MISMATCH",
      "SETTLEMENT_CURRENCY_MISMATCH",
      "SETTLEMENT_ALREADY_NETTED",
      "SEPARATE_APPROVERS_REQUIRED",
    ])
  );
});
