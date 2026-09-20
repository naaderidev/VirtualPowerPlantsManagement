import Decimal from "decimal.js";

export class NettingStatementAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NettingStatementAllocationError";
  }
}

export function deriveNettingStatement(netAmount: Decimal.Value) {
  const signedAmount = new Decimal(netAmount);
  if (!signedAmount.isFinite() || !signedAmount.isInteger()) {
    throw new NettingStatementAllocationError("مبلغ خالص باید عدد صحیح باشد.");
  }
  return {
    direction: signedAmount.isNegative() ? ("PAYABLE" as const) : ("RECEIVABLE" as const),
    amount: signedAmount.abs(),
    initialStatus: signedAmount.isZero() ? ("PAID" as const) : ("ISSUED" as const),
  };
}

type StatementAllocationInput = {
  paymentAmount: Decimal.Value;
  paymentAllocated: Decimal.Value;
  statementAmount: Decimal.Value;
  statementPaid: Decimal.Value;
  allocationAmount: Decimal.Value;
  paymentCurrency: string;
  statementCurrency: string;
};

export function calculateNettingStatementAllocation(input: StatementAllocationInput) {
  if (input.paymentCurrency !== input.statementCurrency) {
    throw new NettingStatementAllocationError("ارز پرداخت و سند خالص‌سازی یکسان نیست.");
  }
  const paymentAmount = new Decimal(input.paymentAmount);
  const statementAmount = new Decimal(input.statementAmount);
  const allocationAmount = new Decimal(input.allocationAmount);
  if (!allocationAmount.isInteger() || allocationAmount.lte(0)) {
    throw new NettingStatementAllocationError("مبلغ تخصیص باید عدد صحیح مثبت باشد.");
  }
  const paymentAllocated = new Decimal(input.paymentAllocated).add(allocationAmount);
  if (paymentAllocated.gt(paymentAmount)) {
    throw new NettingStatementAllocationError("مبلغ تخصیص از مانده پرداخت بیشتر است.");
  }
  const statementPaid = new Decimal(input.statementPaid).add(allocationAmount);
  if (statementPaid.gt(statementAmount)) {
    throw new NettingStatementAllocationError("مبلغ تخصیص از مانده سند خالص‌سازی بیشتر است.");
  }
  return {
    paymentAllocated,
    statementPaid,
    paymentFullyAllocated: paymentAllocated.eq(paymentAmount),
    statementStatus: statementPaid.eq(statementAmount) ? ("PAID" as const) : ("PARTIALLY_PAID" as const),
  };
}
