import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  AmendmentStatus,
  AssetStatus,
  ContractStatus,
  GenerationProfileStatus,
  InvoiceStatus,
  NettingBatchStatus,
  NettingStatementStatus,
  OperationalStatus,
  PartyStatus,
  PaymentStatus,
  PricingStatus,
  ProposalStatus,
  ReadingStatus,
  RequestStatus,
  SettlementStatus,
} from "@prisma/client";
import { getStatusLabel, getStatusTone } from "@/lib/status-labels";
import { GET as getLiveness } from "@/app/api/health/live/route";

test("all persisted statuses have Persian labels and unknown codes never appear raw", () => {
  const statusEnums = [
    AmendmentStatus, AssetStatus, ContractStatus, GenerationProfileStatus,
    InvoiceStatus, NettingBatchStatus, NettingStatementStatus, OperationalStatus,
    PartyStatus, PaymentStatus, PricingStatus, ProposalStatus, ReadingStatus,
    RequestStatus, SettlementStatus,
  ];
  for (const status of statusEnums.flatMap((values) => Object.values(values))) {
    const label = getStatusLabel(status);
    assert.notEqual(label, "وضعیت نامشخص", `Missing Persian label for ${status}`);
    assert.doesNotMatch(label, /[A-Za-z]/, `English label for ${status}`);
  }
  assert.equal(getStatusLabel("FUTURE_STATUS"), "وضعیت نامشخص");
});

test("status badges use consistent positive, negative, and pending tones", () => {
  for (const status of ["ACTIVE", "PAID", "COMPLETED", "CONFIRMED"]) {
    assert.equal(getStatusTone(status), "positive", status);
  }
  for (const status of ["REJECTED", "CANCELLED", "DEPRECATED", "TERMINATED"]) {
    assert.equal(getStatusTone(status), "negative", status);
  }
  for (const status of ["DRAFT", "PENDING_SIGNATURE", "PARTIALLY_PAID", "REVIEW"]) {
    assert.equal(getStatusTone(status), "pending", status);
  }
  assert.equal(getStatusTone("FUTURE_STATUS"), "pending");
});
import {
  createMeterReadingSchema,
  createFinancialConfigurationSchema,
  createSettlementRevisionSchema,
  calculatePriceSchema,
  calculateSettlementSchema,
  createPaymentSchema,
  allocatePaymentSchema,
  createGenerationProfileVersionSchema,
  completeRequestSchema,
  configureContractSchema,
  createContractSchema,
  createPricingPlanSchema,
  createMarketIndexSchema,
  transitionPricingPlanSchema,
  createRequestSchema,
  customerOnboardingSchema,
  paginationSchema,
  updateContractSchema,
  createRepresentativeAssignmentSchema,
  updateRepresentativeAssignmentSchema,
  selectActingPartySchema,
  createNettingBatchSchema,
  updateNettingBatchSchema,
  createNettingStatementSchema,
  allocateNettingPaymentSchema,
  decideProposalSchema,
  operationalReadinessSubmissionSchema,
  eligibleContractRequestQuerySchema,
  assetListQuerySchema,
  disposeAssetSchema,
} from "@/lib/api-schemas";
import { parseJsonBody, parseSearchParams } from "@/lib/api-response";

test("liveness is public, cache-safe, and exposes only release metadata", async () => {
  const response = getLiveness();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(body).sort(), ["environment", "release", "status", "uptimeSeconds"]);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.uptimeSeconds, "number");
});

test("returns the stable error contract for invalid JSON", async () => {
  const request = new Request("http://localhost/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json", "x-correlation-id": "contract-test-1" },
    body: "{invalid",
  });

  const result = await parseJsonBody(request, createRequestSchema);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.response.status, 400);
  assert.equal(result.response.headers.get("x-correlation-id"), "contract-test-1");
  assert.deepEqual(await result.response.json(), {
    error: {
      code: "INVALID_JSON",
      message: "بدنه درخواست JSON معتبر نیست.",
      correlationId: "contract-test-1",
    },
  });
});

test("rejects unbounded pagination", () => {
  const request = new Request("http://localhost/api/assets?page=0&limit=1000");
  const result = parseSearchParams(request, paginationSchema);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 422);
});

test("asset lists hide archived records by default and accept explicit archive filters", () => {
  assert.deepEqual(assetListQuerySchema.parse({}), {
    page: 1,
    limit: 20,
    archiveState: "CURRENT",
  });
  assert.equal(assetListQuerySchema.safeParse({ archiveState: "ARCHIVED" }).success, true);
  assert.equal(assetListQuerySchema.safeParse({ archiveState: "DELETED" }).success, false);
});

test("asset disposal requires a meaningful audit reason", () => {
  assert.equal(disposeAssetSchema.safeParse({ reason: "خطا" }).success, false);
  assert.equal(disposeAssetSchema.safeParse({ reason: "ثبت اشتباه دارایی" }).success, true);
  assert.equal(disposeAssetSchema.safeParse({ reason: "ثبت اشتباه دارایی", archivedAt: null }).success, false);
});

test("validates paginated eligible contract request queries", () => {
  assert.deepEqual(
    eligibleContractRequestQuerySchema.parse({}),
    { mode: "SINGLE", page: 1, limit: 20 },
  );
  assert.equal(
    eligibleContractRequestQuerySchema.safeParse({ mode: "MASTER", page: 2, limit: 10, search: "نیروگاه" }).success,
    true,
  );
  assert.equal(
    eligibleContractRequestQuerySchema.safeParse({ mode: "GROUP", limit: 10 }).success,
    false,
  );
  assert.equal(
    eligibleContractRequestQuerySchema.safeParse({ mode: "SINGLE", limit: 101 }).success,
    false,
  );
});

test("returns field errors for invalid request values", () => {
  const result = createRequestSchema.safeParse({
    plantType: "SOLAR",
    capacity: -1,
    province: "تهران",
    city: "تهران",
    operationalStatus: "OPERATIONAL",
    contactMobile: "1234",
  });

  assert.equal(result.success, false);
  if (result.success) return;
  const fields = result.error.flatten().fieldErrors;
  assert.ok(fields.capacity?.length);
  assert.ok(fields.contactMobile?.length);
});

test("customer onboarding accepts only validated party fields", () => {
  const valid = customerOnboardingSchema.safeParse({
    type: "PERSON",
    displayName: "فروشنده تست",
    nationalId: "0012345678",
    phone: "09191234567",
  });
  const injected = customerOnboardingSchema.safeParse({
    type: "PERSON",
    displayName: "فروشنده تست",
    systemCode: "BARTOO_BUYER",
  });

  assert.equal(valid.success, true);
  assert.equal(injected.success, false);
});

test("representative assignments require a valid period and signatory evidence", () => {
  const valid = createRepresentativeAssignmentSchema.safeParse({
    representativeUserId: "representative-user",
    companyPartyId: "company-party",
    validFrom: "2026-09-14",
    validTo: "2027-09-14",
    canSign: true,
    authorityReference: "وکالت‌نامه ۱۴۰۵/۱۱۲",
  });
  assert.equal(valid.success, true);

  const missingEvidence = createRepresentativeAssignmentSchema.safeParse({
    representativeUserId: "representative-user",
    companyPartyId: "company-party",
    validFrom: "2026-09-14",
    canSign: true,
  });
  assert.equal(missingEvidence.success, false);

  const reversedPeriod = updateRepresentativeAssignmentSchema.safeParse({
    validFrom: "2027-09-14",
    validTo: "2026-09-14",
    canSign: false,
  });
  assert.equal(reversedPeriod.success, false);
});

test("acting-party selection accepts only one explicit party identifier", () => {
  assert.equal(selectActingPartySchema.safeParse({ actingPartyId: "company-a" }).success, true);
  assert.equal(selectActingPartySchema.safeParse({ actingPartyId: "" }).success, false);
  assert.equal(
    selectActingPartySchema.safeParse({ actingPartyId: "company-a", ownerId: "company-b" }).success,
    false
  );
});

test("request persistence isolates each plant and document category", async () => {
  const [schema, migration] = await Promise.all([
    readFile(join(process.cwd(), "prisma/schema.prisma"), "utf8"),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260914150000_scenario_14_2_independent_assets_documents/migration.sql"
      ),
      "utf8"
    ),
  ]);

  assert.match(schema, /assetId\s+String\?\s+@unique/);
  assert.match(schema, /@@unique\(\[requestId, type\]\)/);
  assert.match(schema, /uploadedById\s+String\?/);
  assert.match(migration, /requests_assetId_key/);
  assert.match(migration, /request_documents_requestId_type_key/);
});

test("rejects reversed metering periods", () => {
  const result = createMeterReadingSchema.safeParse({
    assetId: "asset-1",
    periodStart: "2026-02-01",
    periodEnd: "2026-01-01",
    rawEnergy: 10,
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.flatten().fieldErrors.periodEnd?.length);
});

test("requires fixed and market shares to total 100", () => {
  const result = createPricingPlanSchema.safeParse({
    name: "ترکیبی",
    code: "HYBRID-1",
    model: "HYBRID",
    fixedSharePct: 30,
    marketSharePct: 60,
    validFrom: "2026-01-01",
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.flatten().fieldErrors.marketSharePct?.length);
});

test("pricing status contract accepts returning a reviewed plan to draft", () => {
  assert.equal(transitionPricingPlanSchema.safeParse({ status: "DRAFT" }).success, true);
  assert.equal(transitionPricingPlanSchema.safeParse({ status: "UNKNOWN" }).success, false);
});

test("market index observations require a positive value and a calendar period", () => {
  const observation = {
    pricingPlanId: "plan-1",
    period: "1405-06",
    value: 2800,
    indexName: "شاخص بازار برق",
    source: "بورس انرژی",
    timezone: "Asia/Tehran",
    observedAt: "2026-10-01T09:00:00+03:30",
  };

  assert.equal(createMarketIndexSchema.safeParse(observation).success, true);
  assert.equal(createMarketIndexSchema.safeParse({ ...observation, period: "1405-13" }).success, false);
  assert.equal(createMarketIndexSchema.safeParse({ ...observation, value: 0 }).success, false);
});

test("strict contracts do not pass unknown fields to persistence", () => {
  const result = createMeterReadingSchema.safeParse({
    assetId: "asset-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-02-01",
    rawEnergy: 10,
    injectedDatabaseField: "must-not-pass",
  });

  assert.equal(result.success, false);
});

test("does not accept an injected market index in price calculation", () => {
  const result = calculatePriceSchema.safeParse({
    energy: 10,
    period: "1405-06",
    pricingPlanId: "plan-1",
    marketIndex: 12345,
  });
  assert.equal(result.success, false);
});

test("validates effective financial rates and derives approver server-side", () => {
  const valid = createFinancialConfigurationSchema.safeParse({
    name: "مالیات پاییز",
    taxRate: 0.09,
    deductionRate: 0.01,
    validFrom: "2026-09-01",
  });
  assert.equal(valid.success, true);

  const invalid = createFinancialConfigurationSchema.safeParse({
    name: "نرخ نامعتبر",
    taxRate: 9,
    validFrom: "2026-09-01",
    approvedBy: "injected-user",
  });
  assert.equal(invalid.success, false);
});

test("requires an auditable reason and a material change for settlement revision", () => {
  assert.equal(createSettlementRevisionSchema.safeParse({ reason: "اختلاف قرائت" }).success, false);
  assert.equal(createSettlementRevisionSchema.safeParse({ reason: "اختلاف قرائت", acceptedEnergy: 1250 }).success, true);
});

test("settlement calculation accepts only one exact calendar month", () => {
  const base = { contractId: "contract-1", assetId: "asset-1" };
  assert.equal(
    calculateSettlementSchema.safeParse({
      ...base,
      periodStart: "1405/06/01",
      periodEnd: "1405/07/01",
    }).success,
    true
  );
  assert.equal(
    calculateSettlementSchema.safeParse({
      ...base,
      periodStart: "1405/06/02",
      periodEnd: "1405/07/02",
    }).success,
    false
  );
});

test("settlement progress and reading lookup remain scoped to one asset", async () => {
  const [calculationRoute, statusRoute, schema, migration] = await Promise.all([
    readFile(join(process.cwd(), "src/app/api/settlements/calculate/route.ts"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/settlements/[id]/route.ts"), "utf8"),
    readFile(join(process.cwd(), "prisma/schema.prisma"), "utf8"),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260914190000_scenario_14_2_independent_settlements/migration.sql"
      ),
      "utf8"
    ),
  ]);

  assert.match(calculationRoute, /where:\s*\{ contractId, assetId, status: "ACTIVE" \}/);
  assert.match(statusRoute, /assetId: existing\.assetId/);
  assert.match(schema, /@@index\(\[assetId, status, periodStart, periodEnd\]\)/);
  assert.match(migration, /meter_readings_assetId_status_periodStart_periodEnd_idx/);
});

test("netting contracts require unique settlements and an auditable rejection", () => {
  assert.equal(
    createNettingBatchSchema.safeParse({
      groupId: "group-1",
      settlementIds: ["settlement-1", "settlement-2"],
      idempotencyKey: "netting-demo-1",
    }).success,
    true
  );
  assert.equal(
    createNettingBatchSchema.safeParse({
      groupId: "group-1",
      settlementIds: ["settlement-1", "settlement-1"],
      idempotencyKey: "netting-demo-2",
    }).success,
    false
  );
  assert.equal(updateNettingBatchSchema.safeParse({ action: "REJECT" }).success, false);
  assert.equal(
    updateNettingBatchSchema.safeParse({ action: "REJECT", notes: "مغایرت مالی" }).success,
    true
  );
});

test("netting statement and payment allocation require explicit idempotency", () => {
  assert.equal(
    createNettingStatementSchema.safeParse({ idempotencyKey: "statement-batch-1" }).success,
    true
  );
  assert.equal(createNettingStatementSchema.safeParse({}).success, false);
  assert.equal(
    allocateNettingPaymentSchema.safeParse({
      nettingStatementId: "statement-1",
      amount: 1_000_000,
      idempotencyKey: "statement-allocation-1",
    }).success,
    true
  );
  assert.equal(
    allocateNettingPaymentSchema.safeParse({
      nettingStatementId: "statement-1",
      amount: 1_000.5,
      idempotencyKey: "statement-allocation-2",
    }).success,
    false
  );
});

test("netting settlement cannot also issue an individual invoice", async () => {
  const [invoiceRoute, allocationRoute, schema, migration] = await Promise.all([
    readFile(join(process.cwd(), "src/app/api/invoices/route.ts"), "utf8"),
    readFile(
      join(process.cwd(), "src/app/api/payments/[id]/netting-allocations/route.ts"),
      "utf8"
    ),
    readFile(join(process.cwd(), "prisma/schema.prisma"), "utf8"),
    readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260914210000_scenario_14_2_netting_statements_payments/migration.sql"
      ),
      "utf8"
    ),
  ]);

  assert.match(invoiceRoute, /independentInvoiceRestriction\(/);
  assert.match(invoiceRoute, /nettingGroup: settlement\.contract\.nettingGroup/);
  assert.match(allocationRoute, /nettingAllocations/);
  assert.match(schema, /model NettingStatement\s*\{/);
  assert.match(schema, /model NettingPaymentAllocation\s*\{/);
  assert.match(migration, /netting_statements_batchId_key/);
});

test("payment contracts require integer IRR amounts and idempotency", () => {
  assert.equal(createPaymentSchema.safeParse({ amount: 1000.5, paymentDate: "2026-09-13", method: "BANK_TRANSFER", reference: "BANK-1", idempotencyKey: "pay-1" }).success, false);
  assert.equal(createPaymentSchema.safeParse({ amount: 1000, paymentDate: "2026-09-13", method: "BANK_TRANSFER", reference: "BANK-1", idempotencyKey: "pay-1" }).success, true);
  assert.equal(allocatePaymentSchema.safeParse({ invoiceId: "invoice-1", amount: 500, idempotencyKey: "allocation-1" }).success, true);
});

test("generation profile versions require a complete twelve-month forecast", () => {
  const months = { jan: 1, feb: 1, mar: 1, apr: 1, may: 1, jun: 1, jul: 1, aug: 1, sep: 1, oct: 1, nov: 1, dec: 1 };
  assert.equal(createGenerationProfileVersionSchema.safeParse({ year: 1405, method: "HISTORICAL", source: "SCADA", ...months }).success, true);
  const incomplete: Partial<typeof months> = { ...months };
  delete incomplete.dec;
  assert.equal(createGenerationProfileVersionSchema.safeParse({ year: 1405, method: "HISTORICAL", source: "SCADA", ...incomplete }).success, false);
});

test("validates complete power-plant information as one contract", () => {
  const result = completeRequestSchema.safeParse({
    mode: "SUBMIT",
    asset: {
      name: "نیروگاه خورشیدی نمونه",
      type: "SOLAR",
      ownershipPercent: 100,
      requesterRole: "OWNER",
      province: "تهران",
      city: "ری",
      capacityNominal: 50,
      capacitySellable: 40,
      connectionStatus: "CONNECTED",
    },
    meters: [
      { type: "MAIN", serialNumber: "MTR-001", readInterval: "DAILY", dataSource: "MANUAL" },
    ],
  });

  assert.equal(result.success, true);
});

test("rejects duplicate meter types and excess sellable capacity", () => {
  const result = completeRequestSchema.safeParse({
    mode: "SUBMIT",
    asset: {
      name: "نیروگاه خورشیدی نمونه",
      type: "SOLAR",
      ownershipPercent: 100,
      requesterRole: "OWNER",
      province: "تهران",
      city: "ری",
      capacityNominal: 50,
      capacitySellable: 60,
    },
    meters: [
      { type: "MAIN", serialNumber: "MTR-001" },
      { type: "MAIN", serialNumber: "MTR-002" },
    ],
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.issues.some(({ path }) => path.join(".") === "asset.capacitySellable"));
  assert.ok(result.error.issues.some(({ path }) => path.join(".") === "meters"));
});

test("validates the three-layer contract configuration", () => {
  const result = configureContractSchema.safeParse({
    effectiveDate: "2026-10-01",
    expirationDate: "2027-10-01",
    assets: [{ assetId: "asset-1", sharePercent: 100 }],
    schedules: [{
      assetId: "asset-1",
      startDate: "2026-10-01",
      endDate: "2027-10-01",
      volumeType: "MIN_MAX",
      minVolume: 10,
      maxVolume: 20,
      pricingPlanId: "plan-1",
    }],
    meteringAnnex: {
      primarySource: "SMART_METER",
      missingDataPolicy: "BACKUP_THEN_ESTIMATE",
      correctionDeadline: 7,
      disputeDeadline: 10,
    },
  });
  assert.equal(result.success, true);
});

test("master-agreement creation requires exactly two distinct requests", () => {
  const base = {
    type: "PPA",
    effectiveDate: "2026-10-01",
    expirationDate: "2027-10-01",
  };

  assert.equal(
    createContractSchema.safeParse({ ...base, requestIds: ["request-1", "request-2"] }).success,
    true
  );
  assert.equal(
    createContractSchema.safeParse({ ...base, requestIds: ["request-1"] }).success,
    false
  );
  assert.equal(
    createContractSchema.safeParse({ ...base, requestIds: ["request-1", "request-1"] }).success,
    false
  );
});

test("rejects multiple schedules for one contract asset", () => {
  const schedule = {
    assetId: "asset-1",
    startDate: "2026-10-01",
    endDate: "2027-10-01",
    volumeType: "AS_PRODUCED",
    pricingPlanId: "plan-1",
  };
  const result = configureContractSchema.safeParse({
    effectiveDate: "2026-10-01",
    expirationDate: "2027-10-01",
    assets: [{ assetId: "asset-1", sharePercent: 100 }],
    schedules: [schedule, schedule],
    meteringAnnex: { primarySource: "SMART_METER", missingDataPolicy: "BACKUP" },
  });

  assert.equal(result.success, false);
});

test("contract updates distinguish notes from status transitions", () => {
  assert.equal(updateContractSchema.safeParse({ action: "NOTE", notes: "برای بررسی حقوقی ارسال شد" }).success, true);
  assert.equal(updateContractSchema.safeParse({ action: "NOTE", notes: "   " }).success, false);
  assert.equal(updateContractSchema.safeParse({ action: "DELETE", notes: "نامعتبر" }).success, false);
  assert.equal(updateContractSchema.safeParse({ status: "INTERNAL_REVIEW", notes: "ارسال برای بررسی" }).success, true);
});

test("proposal rejection requires a seller reason while acceptance does not", () => {
  assert.equal(decideProposalSchema.safeParse({ id: "proposal-1", status: "ACCEPTED" }).success, true);
  assert.equal(decideProposalSchema.safeParse({ id: "proposal-1", status: "REJECTED" }).success, false);
  assert.equal(
    decideProposalSchema.safeParse({
      id: "proposal-1",
      status: "REJECTED",
      customerNote: "نرخ پیشنهادی پایین است.",
    }).success,
    true,
  );
});

test("operational readiness submission requires connection and a main meter", () => {
  const base = {
    mode: "SUBMIT",
    operationalDate: "2026-09-14",
    connectionStatus: "CONNECTED",
    meters: [{
      type: "MAIN",
      serialNumber: "MAIN-100",
      readInterval: "DAILY",
      dataSource: "SMART_METER",
    }],
  };
  assert.equal(operationalReadinessSubmissionSchema.safeParse(base).success, true);
  assert.equal(
    operationalReadinessSubmissionSchema.safeParse({ ...base, connectionStatus: "PENDING" }).success,
    false,
  );
  assert.equal(operationalReadinessSubmissionSchema.safeParse({ ...base, meters: [] }).success, false);
});

test("rejects schedules outside the selected contract assets", () => {
  const result = configureContractSchema.safeParse({
    effectiveDate: "2026-10-01",
    expirationDate: "2027-10-01",
    assets: [{ assetId: "asset-1", sharePercent: 100 }],
    schedules: [{ assetId: "asset-2", startDate: "2026-10-01", endDate: "2027-10-01", volumeType: "AS_PRODUCED", pricingPlanId: "plan-1" }],
    meteringAnnex: { primarySource: "SMART_METER", missingDataPolicy: "BACKUP" },
  });
  assert.equal(result.success, false);
});

test("API exposes every mutation used by the main workflows", async () => {
  const expectedMethods = [
    ["src/app/api/proposals/route.ts", ["POST", "PATCH"]],
    ["src/app/api/customer/onboarding/route.ts", ["GET", "POST"]],
    ["src/app/api/documents/[id]/route.ts", ["PATCH", "DELETE"]],
    ["src/app/api/assets/[id]/route.ts", ["GET", "PATCH", "DELETE"]],
    ["src/app/api/requests/[id]/route.ts", ["PATCH"]],
    ["src/app/api/requests/[id]/complete/route.ts", ["PUT"]],
    ["src/app/api/requests/[id]/operational-readiness/route.ts", ["PUT"]],
    ["src/app/api/contracts/route.ts", ["POST", "PATCH"]],
    ["src/app/api/contracts/eligible-requests/route.ts", ["GET"]],
    ["src/app/api/contracts/[id]/configuration/route.ts", ["PUT"]],
    ["src/app/api/contracts/[id]/signatures/route.ts", ["POST"]],
    ["src/app/api/contracts/[id]/amendments/route.ts", ["POST"]],
    ["src/app/api/market-indices/route.ts", ["GET", "POST"]],
    ["src/app/api/financial-configurations/route.ts", ["GET", "POST"]],
    ["src/app/api/pricing-rules/[id]/status/route.ts", ["PATCH"]],
    ["src/app/api/pricing-rules/[id]/versions/route.ts", ["POST"]],
    ["src/app/api/settlements/calculate/route.ts", ["POST"]],
    ["src/app/api/settlements/[id]/revisions/route.ts", ["POST"]],
    ["src/app/api/netting/groups/route.ts", ["GET", "POST"]],
    ["src/app/api/netting/batches/route.ts", ["GET", "POST"]],
    ["src/app/api/netting/batches/[id]/route.ts", ["GET", "PATCH"]],
    ["src/app/api/netting/batches/[id]/statement/route.ts", ["POST"]],
    ["src/app/api/netting/statements/route.ts", ["GET"]],
    ["src/app/api/invoices/route.ts", ["POST"]],
    ["src/app/api/payments/route.ts", ["GET", "POST"]],
    ["src/app/api/payments/[id]/route.ts", ["PATCH"]],
    ["src/app/api/payments/[id]/allocations/route.ts", ["POST"]],
    ["src/app/api/payments/[id]/netting-allocations/route.ts", ["POST"]],
    ["src/app/api/assets/[id]/generation-profiles/route.ts", ["GET", "POST"]],
    ["src/app/api/assets/[id]/generation-profiles/[profileId]/status/route.ts", ["PATCH"]],
    ["src/app/api/representatives/route.ts", ["GET", "POST"]],
    ["src/app/api/representatives/[id]/route.ts", ["PATCH", "DELETE"]],
    ["src/app/api/customer/acting-party/route.ts", ["GET", "POST", "DELETE"]],
    ["src/app/api/payments/route.ts", ["GET", "POST"]],
    ["src/app/api/payments/[id]/route.ts", ["PATCH"]],
    ["src/app/api/payments/[id]/allocations/route.ts", ["POST"]],
    ["src/app/api/assets/[id]/generation-profiles/route.ts", ["GET", "POST"]],
    ["src/app/api/assets/[id]/generation-profiles/[profileId]/status/route.ts", ["PATCH"]],
  ] as const;

  for (const [relativePath, methods] of expectedMethods) {
    const source = await readFile(join(process.cwd(), relativePath), "utf8");
    for (const method of methods) {
      assert.match(source, new RegExp(`export async function ${method}\\b`), `${relativePath} must expose ${method}`);
    }
  }
});

test("contract creation uses a generic paginated request picker", async () => {
  const source = await readFile(join(process.cwd(), "src/app/admin/contracts/new/page.tsx"), "utf8");
  assert.match(source, /قرارداد تک‌نیروگاهی/);
  assert.match(source, /توافق‌نامه مادر/);
  assert.match(source, /api\/contracts\/eligible-requests/);
  assert.match(source, /<Table>/);
  assert.doesNotMatch(source, /limit=100/);
});

test("main payment UI is backed by API data instead of demo rows", async () => {
  const source = await readFile(join(process.cwd(), "src/app/admin/payments/page.tsx"), "utf8");
  assert.doesNotMatch(source, /demoPayments/);
  assert.match(source, /fetch\("\/api\/payments/);
});

test("users and netting pages do not render demo domain rows", async () => {
  const [users, netting] = await Promise.all([
    readFile(join(process.cwd(), "src/app/admin/users/page.tsx"), "utf8"),
    readFile(join(process.cwd(), "src/app/admin/netting/page.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(users, /demoUsers/);
  assert.doesNotMatch(netting, /demoNettings/);
});

test("customer document upload checks completed initial review before touching storage", async () => {
  const source = await readFile(
    join(process.cwd(), "src/app/api/documents/route.ts"),
    "utf8",
  );
  const initialReviewGateIndex = source.indexOf(
    "!canCustomerUploadRequestDocuments(requestRecord.reviews)",
  );
  const storageWriteIndex = source.indexOf("await mkdir(uploadDir");

  assert.notEqual(initialReviewGateIndex, -1);
  assert.notEqual(storageWriteIndex, -1);
  assert.ok(
    initialReviewGateIndex < storageWriteIndex,
    "initial review completion must be checked before an upload directory is created",
  );
});

test("contract activation and configuration enforce operational and residual-capacity guards", async () => {
  const [contractRoute, configurationRoute, assetRoute] = await Promise.all([
    readFile(join(process.cwd(), "src/app/api/contracts/route.ts"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/contracts/[id]/configuration/route.ts"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/assets/[id]/route.ts"), "utf8"),
  ]);

  assert.match(contractRoute, /getStoredContractActivationReadiness/);
  assert.match(configurationRoute, /getExistingContractConflicts/);
  assert.match(assetRoute, /evaluateOperationalReadiness/);
  assert.match(assetRoute, /operationalStatus: "ACTIVE"/);
});

test("asset disposal covers all persisted dependencies and preserves linked records by archival", async () => {
  const source = await readFile(join(process.cwd(), "src/app/api/assets/[id]/route.ts"), "utf8");
  for (const relation of [
    "meters",
    "requests",
    "settlements",
    "assetDocuments",
    "contractAssets",
    "commercialSchedules",
    "meterReadings",
    "generationProfileVersions",
    "generationProfile",
  ]) {
    assert.match(source, new RegExp(`\\b${relation}\\b`), `${relation} must participate in disposition`);
  }
  assert.match(source, /DELETE_UNUSED_ASSET/);
  assert.match(source, /ARCHIVE_ASSET/);
  assert.match(source, /archivedAt/);
  assert.match(source, /contractAssets: openContractLinks/);
  assert.match(source, /if \(asset\.contractAssets\.length > 0\)/);
  assert.match(source, /تا زمانی که قرارداد مرتبط باز است، بایگانی این دارایی مجاز نیست/);
  assert.match(source, /دارایی بایگانی‌شده قابل ویرایش یا فعال‌سازی مجدد نیست/);
  assert.match(source, /requireApiUser\(\["ADMIN"\]\)/);
});

test("seller cannot bypass the submitted-information lock through the general asset API", async () => {
  const [assetRoute, completionRoute, readinessRoute] = await Promise.all([
    readFile(join(process.cwd(), "src/app/api/assets/[id]/route.ts"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/requests/[id]/complete/route.ts"), "utf8"),
    readFile(join(process.cwd(), "src/app/api/requests/[id]/operational-readiness/route.ts"), "utf8"),
  ]);

  assert.doesNotMatch(assetRoute, /requireApiUser\(\[\.\.\.TECHNICAL_ROLES, \.\.\.CUSTOMER_ROLES/);
  assert.match(completionRoute, /canCompleteRequestInformation/);
  assert.match(readinessRoute, /canSubmitOperationalReadiness/);
  assert.match(readinessRoute, /REQUIRED_OPERATIONAL_DOCUMENTS/);
});

test("company requests always keep the single-plant contract path and conditionally offer a master agreement", async () => {
  const source = await readFile(
    join(process.cwd(), "src/app/admin/requests/[id]/page.tsx"),
    "utf8",
  );

  assert.match(source, /admin\/requests\/\$\{id\}\/contract/);
  assert.match(source, /canCreateScenario142MasterAgreement/);
  assert.match(source, /eligibleMasterAgreementRequestCount/);
});
