export type FinancialConfigurationPeriod = {
  validFrom: Date;
  validTo: Date | null;
};

// The end is exclusive: a setting ending on the first day of a month
// may be followed by a new setting starting on that same day.
export function financialConfigurationPeriodsOverlap(
  first: FinancialConfigurationPeriod,
  second: FinancialConfigurationPeriod,
): boolean {
  return first.validFrom.getTime() < (second.validTo?.getTime() ?? Infinity)
    && second.validFrom.getTime() < (first.validTo?.getTime() ?? Infinity);
}
