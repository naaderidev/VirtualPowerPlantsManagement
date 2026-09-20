import Decimal from "decimal.js";
import { calculatePrice, type PricingPlanData, type PricingResult } from "@/lib/pricing-engine";

export type SettlementAdjustment = { type: string; amount: number; reason: string };

export type SettlementCalculationInput = {
  energyRegistered: number;
  energyAccepted: number;
  energyRejected: number;
  period: string;
  pricingPlan: PricingPlanData;
  marketIndex?: number;
  taxRate: number;
  deductionRate: number;
  adjustments?: SettlementAdjustment[];
};

export type SettlementCalculation = {
  pricing: PricingResult;
  adjustmentTotal: number;
  grossAmount: number;
  deductions: number;
  taxAmount: number;
  netAmount: number;
};

export function calculateSettlementAmounts(input: SettlementCalculationInput): SettlementCalculation {
  if (input.energyAccepted > input.energyRegistered) throw new Error("انرژی پذیرفته‌شده از انرژی ثبت‌شده بیشتر است.");
  if (input.energyRejected < 0 || input.energyAccepted + input.energyRejected > input.energyRegistered) {
    throw new Error("جمع انرژی پذیرفته‌شده و ردشده معتبر نیست.");
  }
  const pricing = calculatePrice({
    energy: input.energyAccepted,
    period: input.period,
    pricingPlan: input.pricingPlan,
    marketIndex: input.marketIndex,
  });
  const adjustmentTotal = (input.adjustments ?? []).reduce(
    (sum, adjustment) => sum.add(adjustment.amount),
    new Decimal(0)
  );
  const gross = new Decimal(pricing.totalAmount).add(adjustmentTotal);
  const deductions = gross.mul(input.deductionRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const taxable = gross.sub(deductions);
  const tax = taxable.mul(input.taxRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const net = taxable.add(tax).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return {
    pricing,
    adjustmentTotal: adjustmentTotal.toNumber(),
    grossAmount: gross.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    deductions: deductions.toNumber(),
    taxAmount: tax.toNumber(),
    netAmount: net.toNumber(),
  };
}
