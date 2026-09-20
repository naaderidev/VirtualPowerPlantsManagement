import Decimal from "decimal.js";

export type PricingPlanData = {
  id: string;
  name: string;
  version?: number;
  model: "FIXED" | "MARKET_INDEX" | "HYBRID" | "FLOOR";
  fixedRate?: number | null;
  fixedRateHybrid?: number | null;
  multiplier: number;
  differential: number;
  fixedSharePct?: number | null;
  marketSharePct?: number | null;
  floorValue?: number | null;
  ceilingValue?: number | null;
  currency: string;
  energyUnit: string;
  roundingMethod?: string;
  roundingDigits?: number;
};

export type PricingInput = {
  energy: number;
  period: string;
  pricingPlan: PricingPlanData;
  marketIndex?: number;
};

export type PricingResult = {
  unitPrice: number;
  rawUnitPrice: number;
  baseAmount: number;
  totalAmount: number;
  formula: string;
  breakdown: { fixedComponent?: number; marketComponent?: number; rawPrice: number };
  currency: string;
  energyUnit: string;
  rounding: { method: "ROUND_HALF_UP"; unitPriceDigits: number; amountDigits: number };
};

export class PricingCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingCalculationError";
  }
}

function requireValue(value: number | null | undefined, message: string): Decimal {
  if (value == null) throw new PricingCalculationError(message);
  return new Decimal(value);
}

function needsMarketIndex(model: PricingPlanData["model"]): boolean {
  return model === "MARKET_INDEX" || model === "HYBRID" || model === "FLOOR";
}

function calculateRawUnitPrice(plan: PricingPlanData, marketIndex?: number): {
  raw: Decimal;
  fixedComponent?: Decimal;
  marketComponent?: Decimal;
  formula: string;
} {
  const multiplier = new Decimal(plan.multiplier);
  const differential = new Decimal(plan.differential);
  if (plan.model === "FIXED") {
    const rate = requireValue(plan.fixedRate, "نرخ ثابت در نرخ‌نامه تعریف نشده است.");
    const raw = rate.mul(multiplier).add(differential);
    return { raw, fixedComponent: rate, formula: `(${rate} × ${multiplier}) + ${differential}` };
  }

  if (needsMarketIndex(plan.model) && marketIndex == null) {
    throw new PricingCalculationError("شاخص معتبر بازار برای این دوره ثبت نشده است.");
  }
  const index = new Decimal(marketIndex!);
  if (plan.model === "MARKET_INDEX" || plan.model === "FLOOR") {
    const raw = index.mul(multiplier).add(differential);
    return { raw, marketComponent: index, formula: `(${index} × ${multiplier}) + ${differential}` };
  }

  const fixedShare = requireValue(plan.fixedSharePct, "سهم ثابت نرخ‌نامه ترکیبی تعریف نشده است.").div(100);
  const marketShare = requireValue(plan.marketSharePct, "سهم بازار نرخ‌نامه ترکیبی تعریف نشده است.").div(100);
  if (!fixedShare.add(marketShare).eq(1)) {
    throw new PricingCalculationError("مجموع سهم ثابت و بازار باید دقیقاً ۱۰۰ درصد باشد.");
  }
  const fixedRate = requireValue(plan.fixedRateHybrid ?? plan.fixedRate, "نرخ ثابت نرخ‌نامه ترکیبی تعریف نشده است.");
  const fixedComponent = fixedShare.mul(fixedRate);
  const marketComponent = marketShare.mul(index).mul(multiplier);
  const raw = fixedComponent.add(marketComponent).add(differential);
  return {
    raw,
    fixedComponent,
    marketComponent,
    formula: `(${fixedShare} × ${fixedRate}) + (${marketShare} × ${index} × ${multiplier}) + ${differential}`,
  };
}

function clampUnitPrice(raw: Decimal, plan: PricingPlanData): Decimal {
  const withFloor = plan.floorValue == null ? raw : Decimal.max(raw, plan.floorValue);
  return plan.ceilingValue == null ? withFloor : Decimal.min(withFloor, plan.ceilingValue);
}

export function calculatePrice(input: PricingInput): PricingResult {
  if (!Number.isFinite(input.energy) || input.energy <= 0) {
    throw new PricingCalculationError("انرژی باید عددی مثبت باشد.");
  }
  if (input.pricingPlan.roundingMethod && input.pricingPlan.roundingMethod !== "ROUND_HALF_UP") {
    throw new PricingCalculationError("روش گردکردن نرخ‌نامه پشتیبانی نمی‌شود.");
  }
  const components = calculateRawUnitPrice(input.pricingPlan, input.marketIndex);
  const unitDigits = input.pricingPlan.roundingDigits ?? 6;
  const amountDigits = input.pricingPlan.currency === "IRR" ? 0 : 2;
  const finalUnitPrice = clampUnitPrice(components.raw, input.pricingPlan).toDecimalPlaces(unitDigits, Decimal.ROUND_HALF_UP);
  const baseAmount = new Decimal(input.energy).mul(components.raw).toDecimalPlaces(amountDigits, Decimal.ROUND_HALF_UP);
  const totalAmount = new Decimal(input.energy).mul(finalUnitPrice).toDecimalPlaces(amountDigits, Decimal.ROUND_HALF_UP);

  return {
    unitPrice: finalUnitPrice.toNumber(),
    rawUnitPrice: components.raw.toNumber(),
    baseAmount: baseAmount.toNumber(),
    totalAmount: totalAmount.toNumber(),
    formula: `${components.formula}; unitPrice=${finalUnitPrice}; amount=${input.energy} × ${finalUnitPrice}`,
    breakdown: {
      ...(components.fixedComponent && { fixedComponent: components.fixedComponent.toNumber() }),
      ...(components.marketComponent && { marketComponent: components.marketComponent.toNumber() }),
      rawPrice: components.raw.toNumber(),
    },
    currency: input.pricingPlan.currency,
    energyUnit: input.pricingPlan.energyUnit,
    rounding: { method: "ROUND_HALF_UP", unitPriceDigits: unitDigits, amountDigits },
  };
}
