import Decimal from "decimal.js";

export class PaymentAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentAllocationError";
  }
}

type AllocationInput = {
  paymentAmount: Decimal.Value;
  paymentAllocated: Decimal.Value;
  invoiceAmount: Decimal.Value;
  invoicePaid: Decimal.Value;
  allocationAmount: Decimal.Value;
  paymentCurrency: string;
  invoiceCurrency: string;
};

export type AllocationResult = {
  paymentAllocated: Decimal;
  invoicePaid: Decimal;
  paymentFullyAllocated: boolean;
  invoiceStatus: "PARTIALLY_PAID" | "PAID";
};

export function calculatePaymentAllocation(input: AllocationInput): AllocationResult {
  if (input.paymentCurrency !== input.invoiceCurrency) {
    throw new PaymentAllocationError("ارز پرداخت و صورتحساب یکسان نیست.");
  }

  const paymentAmount = new Decimal(input.paymentAmount);
  const paymentAllocated = new Decimal(input.paymentAllocated);
  const invoiceAmount = new Decimal(input.invoiceAmount);
  const invoicePaid = new Decimal(input.invoicePaid);
  const allocationAmount = new Decimal(input.allocationAmount);
  if (!allocationAmount.isInteger() || allocationAmount.lte(0)) {
    throw new PaymentAllocationError("مبلغ تخصیص باید عدد صحیح مثبت باشد.");
  }

  const nextPaymentAllocated = paymentAllocated.add(allocationAmount);
  if (nextPaymentAllocated.gt(paymentAmount)) {
    throw new PaymentAllocationError("مبلغ تخصیص از مانده پرداخت بیشتر است.");
  }

  const nextInvoicePaid = invoicePaid.add(allocationAmount);
  if (nextInvoicePaid.gt(invoiceAmount)) {
    throw new PaymentAllocationError("مبلغ تخصیص از مانده صورتحساب بیشتر است.");
  }

  return {
    paymentAllocated: nextPaymentAllocated,
    invoicePaid: nextInvoicePaid,
    paymentFullyAllocated: nextPaymentAllocated.eq(paymentAmount),
    invoiceStatus: nextInvoicePaid.eq(invoiceAmount) ? "PAID" : "PARTIALLY_PAID",
  };
}
