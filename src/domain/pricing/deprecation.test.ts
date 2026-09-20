import assert from "node:assert/strict";
import test from "node:test";
import { hasOutstandingPricingObligation, isPricingPlanUsableForSettlement } from "./deprecation";

const boundary = new Date("2026-09-20T00:00:00.000Z");

test("future delivery on a live contract blocks deprecation", () => {
  assert.equal(hasOutstandingPricingObligation({ scheduleActive: true, scheduleEndDate: new Date("2026-10-01T00:00:00.000Z"), contractStatus: "ACTIVE", now: boundary }), true);
  assert.equal(hasOutstandingPricingObligation({ scheduleActive: true, scheduleEndDate: new Date("2026-10-01T00:00:00.000Z"), contractStatus: "SIGNED", now: boundary }), true);
  assert.equal(hasOutstandingPricingObligation({ scheduleActive: false, scheduleEndDate: new Date("2026-10-01T00:00:00.000Z"), contractStatus: "ACTIVE", now: boundary }), false);
  assert.equal(hasOutstandingPricingObligation({ scheduleActive: true, scheduleEndDate: new Date("2026-10-01T00:00:00.000Z"), contractStatus: "TERMINATED", now: boundary }), false);
  assert.equal(hasOutstandingPricingObligation({ scheduleActive: true, scheduleEndDate: boundary, contractStatus: "ACTIVE", now: boundary }), false);
});

test("deprecated plan still prices delivery completed before deprecation", () => {
  assert.equal(isPricingPlanUsableForSettlement({ status: "DEPRECATED", deprecatedAt: boundary, periodEnd: boundary }), true);
  assert.equal(isPricingPlanUsableForSettlement({ status: "DEPRECATED", deprecatedAt: boundary, periodEnd: new Date("2026-10-01T00:00:00.000Z") }), false);
  assert.equal(isPricingPlanUsableForSettlement({ status: "DEPRECATED", deprecatedAt: null, periodEnd: boundary }), false);
  assert.equal(isPricingPlanUsableForSettlement({ status: "DRAFT", deprecatedAt: null, periodEnd: boundary }), false);
  assert.equal(isPricingPlanUsableForSettlement({ status: "ACTIVE", deprecatedAt: null, periodEnd: boundary }), true);
});
