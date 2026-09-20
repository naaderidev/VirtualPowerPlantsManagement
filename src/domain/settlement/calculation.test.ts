import assert from "node:assert/strict";
import test from "node:test";
import { calculatePrice, PricingCalculationError } from "@/lib/pricing-engine";
import { calculateSettlementAmounts } from "./calculation";

const basePlan = { id: "p", name: "plan", version: 2, model: "MARKET_INDEX" as const, multiplier: 1, differential: 0, floorValue: 100, ceilingValue: 200, currency: "IRR", energyUnit: "kWh", roundingMethod: "ROUND_HALF_UP", roundingDigits: 2 };

test("rejects a missing market index instead of using zero", () => {
  assert.throws(() => calculatePrice({ energy: 10, period: "1405-06", pricingPlan: basePlan }), PricingCalculationError);
});

test("applies floor and ceiling to unit price before amount", () => {
  const result = calculatePrice({ energy: 10, period: "1405-06", pricingPlan: basePlan, marketIndex: 50 });
  assert.equal(result.unitPrice, 100);
  assert.equal(result.totalAmount, 1000);
});

test("calculates tax and deductions from explicit configuration", () => {
  const result = calculateSettlementAmounts({ energyRegistered: 12, energyAccepted: 10, energyRejected: 2, period: "1405-06", pricingPlan: basePlan, marketIndex: 150, taxRate: 0.09, deductionRate: 0.01 });
  assert.deepEqual({ gross: result.grossAmount, deductions: result.deductions, tax: result.taxAmount, net: result.netAmount }, { gross: 1500, deductions: 15, tax: 134, net: 1619 });
});
