import Decimal from "decimal.js";

export type NettingCandidate = {
  settlementId: string;
  assetId: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  direction: "RECEIVABLE" | "PAYABLE" | null;
  amount: string | number;
  locked: boolean;
  belongsToGroup: boolean;
  nettingEnabled: boolean;
};

export type NettingEligibilityViolation =
  | "AT_LEAST_TWO_SETTLEMENTS_REQUIRED"
  | "DUPLICATE_SETTLEMENT"
  | "SETTLEMENT_NOT_CONFIRMED"
  | "SETTLEMENT_PERIOD_MISMATCH"
  | "SETTLEMENT_CURRENCY_MISMATCH"
  | "DISTINCT_ASSETS_REQUIRED"
  | "SETTLEMENT_ALREADY_NETTED"
  | "SETTLEMENT_PARTY_MISMATCH"
  | "NETTING_NOT_ENABLED"
  | "INVALID_AMOUNT";

export function validateNettingCandidates(
  candidates: readonly NettingCandidate[]
): NettingEligibilityViolation[] {
  const violations = new Set<NettingEligibilityViolation>();
  if (candidates.length < 2) violations.add("AT_LEAST_TWO_SETTLEMENTS_REQUIRED");
  if (new Set(candidates.map(({ settlementId }) => settlementId)).size !== candidates.length) {
    violations.add("DUPLICATE_SETTLEMENT");
  }
  if (candidates.some(({ status }) => status !== "CONFIRMED")) {
    violations.add("SETTLEMENT_NOT_CONFIRMED");
  }
  if (candidates.some(({ locked }) => locked)) violations.add("SETTLEMENT_ALREADY_NETTED");
  if (candidates.some(({ belongsToGroup, direction }) => !belongsToGroup || !direction)) {
    violations.add("SETTLEMENT_PARTY_MISMATCH");
  }
  if (candidates.some(({ nettingEnabled }) => !nettingEnabled)) {
    violations.add("NETTING_NOT_ENABLED");
  }
  if (new Set(candidates.map(({ assetId }) => assetId)).size < 2) {
    violations.add("DISTINCT_ASSETS_REQUIRED");
  }
  const [first] = candidates;
  if (first) {
    if (
      candidates.some(
        ({ periodStart, periodEnd }) =>
          periodStart.getTime() !== first.periodStart.getTime() ||
          periodEnd.getTime() !== first.periodEnd.getTime()
      )
    ) {
      violations.add("SETTLEMENT_PERIOD_MISMATCH");
    }
    if (candidates.some(({ currency }) => currency !== first.currency)) {
      violations.add("SETTLEMENT_CURRENCY_MISMATCH");
    }
  }
  if (
    candidates.some(({ amount }) => {
      const value = new Decimal(amount);
      return !value.isFinite() || value.isNegative() || !value.isInteger();
    })
  ) {
    violations.add("INVALID_AMOUNT");
  }
  return [...violations];
}

export function calculateNettingTotals(
  candidates: readonly Pick<NettingCandidate, "direction" | "amount">[]
) {
  const totalReceivable = candidates
    .filter(({ direction }) => direction === "RECEIVABLE")
    .reduce((total, { amount }) => total.add(amount), new Decimal(0));
  const totalPayable = candidates
    .filter(({ direction }) => direction === "PAYABLE")
    .reduce((total, { amount }) => total.add(amount), new Decimal(0));
  return {
    totalReceivable: totalReceivable.toFixed(0),
    totalPayable: totalPayable.toFixed(0),
    netAmount: totalReceivable.sub(totalPayable).toFixed(0),
  };
}
