import assert from "node:assert/strict";
import test from "node:test";
import { getContractConfigurationPresentation } from "@/app/admin/contracts/[id]/configure/_lib/presentation";

test("uses the full content width for a single commercial schedule", () => {
  const presentation = getContractConfigurationPresentation(1);
  assert.equal(presentation.scheduleGridClassName, "grid gap-4");
  assert.deepEqual(presentation.scheduleCardClassNames, [""]);
  assert.equal(presentation.actionLabel, "ذخیره برنامه و تکمیل پیکربندی");
});

test("balances two schedules in two equal desktop columns", () => {
  const presentation = getContractConfigurationPresentation(2);
  assert.match(presentation.scheduleGridClassName, /xl:grid-cols-2/);
  assert.deepEqual(presentation.scheduleCardClassNames, ["", ""]);
  assert.equal(presentation.actionLabel, "ذخیره ۲ برنامه و تکمیل پیکربندی");
});

test("makes the third schedule full-width until three columns fit", () => {
  const presentation = getContractConfigurationPresentation(3);
  assert.match(presentation.scheduleGridClassName, /2xl:grid-cols-3/);
  assert.equal(presentation.scheduleCardClassNames[2], "lg:col-span-2 2xl:col-span-1");
  assert.equal(presentation.actionLabel, "ذخیره ۳ برنامه و تکمیل پیکربندی");
});
