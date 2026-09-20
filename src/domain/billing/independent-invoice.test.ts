import assert from "node:assert/strict";
import test from "node:test";
import { independentInvoiceRestriction } from "./independent-invoice";

const ordinary = {
  hasNettingReservation: false,
  contractNettingEnabled: false,
  scheduleNettingEnabled: false,
  nettingGroup: null,
};

test("an ordinary confirmed settlement can still receive an independent invoice", () => {
  assert.equal(independentInvoiceRestriction(ordinary), null);
});

test("a settlement reserved by a netting batch cannot receive a second document", () => {
  assert.match(independentInvoiceRestriction({ ...ordinary, hasNettingReservation: true }) ?? "", /وارد خالص‌سازی/);
});

test("an active netting group reserves its contract settlements before batch creation", () => {
  const grouped = {
    ...ordinary,
    contractNettingEnabled: true,
    scheduleNettingEnabled: true,
    nettingGroup: { active: true, mode: "MANUAL" },
  };
  assert.match(independentInvoiceRestriction(grouped) ?? "", /سند مالی خالص‌سازی/);
  assert.equal(independentInvoiceRestriction({ ...grouped, nettingGroup: { active: false, mode: "MANUAL" } }), null);
  assert.equal(independentInvoiceRestriction({ ...grouped, scheduleNettingEnabled: false }), null);
});
