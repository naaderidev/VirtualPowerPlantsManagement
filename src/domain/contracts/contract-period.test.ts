import assert from "node:assert/strict";
import test from "node:test";
import { alignContractPeriodToFullMonths, fullSettlementMonths, getContractPeriodIssue, suggestContractPeriod } from "./contract-period";

const today = new Date(2026, 8, 15);

test("suggests today and the accepted proposal duration for an operational plant", () => {
  assert.deepEqual(suggestContractPeriod({ today, durationMonths: 12 }), {
    effectiveDate: "1405/06/24",
    expirationDate: "1406/06/24",
  });
});

test("uses a future operational date as the suggested contract start", () => {
  assert.deepEqual(suggestContractPeriod({
    today,
    durationMonths: 6,
    operationalDates: ["2026-11-01T00:00:00.000Z"],
  }), {
    effectiveDate: "1405/08/10",
    expirationDate: "1406/02/10",
  });
});

test("returns a field-level message for reversed and expired periods", () => {
  assert.deepEqual(
    getContractPeriodIssue({ effectiveDate: "2026-10-01", expirationDate: "2026-09-01" }, today),
    { field: "expirationDate", message: "تاریخ پایان باید بعد از تاریخ شروع باشد." },
  );
  assert.deepEqual(
    getContractPeriodIssue({ effectiveDate: "2026-07-01", expirationDate: "2026-08-01" }, today),
    { field: "expirationDate", message: "تاریخ پایان قرارداد نمی‌تواند گذشته باشد." },
  );
});

test("counts only complete Persian calendar months within a contract", () => {
  assert.equal(fullSettlementMonths({ effectiveDate: "1405/06/28", expirationDate: "1406/06/28" }).length, 11);
  assert.equal(fullSettlementMonths({ effectiveDate: "1405/07/01", expirationDate: "1406/07/01" }).length, 12);
  assert.deepEqual(fullSettlementMonths({ effectiveDate: "1405/05/01", expirationDate: "1405/06/01" }), ["1405-05"]);
});

test("suggests a future first-of-month term without silently backdating", () => {
  assert.deepEqual(alignContractPeriodToFullMonths({ effectiveDate: "1405/06/28", expirationDate: "1406/06/28" }), {
    effectiveDate: "1405/07/01", expirationDate: "1406/07/01",
  });
  assert.deepEqual(alignContractPeriodToFullMonths({ effectiveDate: "1405/05/01", expirationDate: "1406/05/01" }), {
    effectiveDate: "1405/05/01", expirationDate: "1406/05/01",
  });
});
