import assert from "node:assert/strict";
import test from "node:test";
import { calculateNettingTotals, validateNettingCandidates, type NettingCandidate } from "./calculation";

const base: NettingCandidate[] = [
  {
    settlementId: "settlement-1",
    assetId: "asset-1",
    status: "CONFIRMED",
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
    periodEnd: new Date("2026-10-01T00:00:00.000Z"),
    currency: "IRR",
    direction: "RECEIVABLE",
    amount: "1200",
    locked: false,
    belongsToGroup: true,
    nettingEnabled: true,
  },
  {
    settlementId: "settlement-2",
    assetId: "asset-2",
    status: "CONFIRMED",
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
    periodEnd: new Date("2026-10-01T00:00:00.000Z"),
    currency: "IRR",
    direction: "PAYABLE",
    amount: "200",
    locked: false,
    belongsToGroup: true,
    nettingEnabled: true,
  },
];

test("accepts two confirmed same-period settlements from distinct assets", () => {
  assert.deepEqual(validateNettingCandidates(base), []);
  assert.deepEqual(calculateNettingTotals(base), {
    totalReceivable: "1200",
    totalPayable: "200",
    netAmount: "1000",
  });
});

test("rejects mismatched, locked, and unconfirmed candidates", () => {
  const invalid = [
    base[0],
    {
      ...base[1],
      status: "UNDER_REVIEW",
      periodEnd: new Date("2026-11-01T00:00:00.000Z"),
      currency: "USD",
      locked: true,
    },
  ];
  assert.deepEqual(
    new Set(validateNettingCandidates(invalid)),
    new Set([
      "SETTLEMENT_NOT_CONFIRMED",
      "SETTLEMENT_ALREADY_NETTED",
      "SETTLEMENT_PERIOD_MISMATCH",
      "SETTLEMENT_CURRENCY_MISMATCH",
    ])
  );
});

test("rejects repeated assets and contracts outside the group", () => {
  const invalid = [base[0], { ...base[1], assetId: "asset-1", belongsToGroup: false, direction: null }];
  const violations = validateNettingCandidates(invalid);
  assert.ok(violations.includes("DISTINCT_ASSETS_REQUIRED"));
  assert.ok(violations.includes("SETTLEMENT_PARTY_MISMATCH"));
});
