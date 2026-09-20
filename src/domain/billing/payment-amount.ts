import Decimal from "decimal.js";

export function remainingPaymentAmount(amount: string | number, paidAmount: string | number): string | null {
  const total = new Decimal(amount);
  const paid = new Decimal(paidAmount);
  const remaining = total.minus(paid);
  return remaining.isFinite() && remaining.isInteger() && remaining.gt(0) ? remaining.toFixed(0) : null;
}

export function suggestedAllocationAmount(paymentAmount: string, documentRemaining: string): string | null {
  const payment = new Decimal(paymentAmount);
  const remaining = new Decimal(documentRemaining);
  const suggested = Decimal.min(payment, remaining);
  return suggested.isFinite() && suggested.isInteger() && suggested.gt(0) ? suggested.toFixed(0) : null;
}
