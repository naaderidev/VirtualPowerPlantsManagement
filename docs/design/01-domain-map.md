# VPP — Domain Map

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PARTY DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Party                                                              │
│  ├── Person (real person)                                           │
│  └── Company (legal entity)                                         │
│       │                                                             │
│       ├── User[] ──────────── login, mobile, email, role            │
│       ├── BusinessRelation[] ── SELLER | BUYER | INSTALLER         │
│       ├── Relationship[] ──── entity-to-entity binding              │
│       ├── Asset[] ─────────── owned power plants                    │
│       ├── ContractParty[] ─── roles in contracts                    │
│       └── NettingGroup[] ──── netting membership                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          ASSET DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Asset (Power Plant)                                                │
│  ├── Owner ────────────────── Party                                 │
│  ├── Location ─────────────── province, city, coords                │
│  ├── Capacity ─────────────── nominal, sellable                     │
│  ├── Meter[] ──────────────── main, backup, serial, source          │
│  ├── GenerationProfile ────── 12-month expected output              │
│  ├── AssetDocument[] ──────── ownership, license, connection        │
│  ├── ContractAsset[] ──────── linked contracts                      │
│  └── Settlement[] ─────────── period settlements                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        REQUEST DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Request (Case)                                                     │
│  ├── Party ────────────────── applicant                             │
│  ├── Asset ────────────────── (linked after approval)               │
│  ├── RequestReview[] ──────── review history                        │
│  ├── RequestDocument[] ────── uploaded docs                         │
│  └── Workflow State ────────── status machine                       │
│                                                                     │
│  Flow:                                                              │
│  Initial Request → Review → Complete Info → Ownership Review        │
│  → Proposal → Contract → Active → Settlement → Payment              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        CONTRACT DOMAIN                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Contract (PPA)                                                     │
│  ├── Master Agreement ──────── fixed legal terms                    │
│  ├── CommercialSchedule[] ──── per-asset terms                      │
│  │   ├── Asset ─────────────── power plant                          │
│  │   ├── PricingPlan ───────── price formula                        │
│  │   ├── VolumeType ────────── AS_PRODUCED | FIXED | MIN_MAX        │
│  │   └── SettlementCycle ───── MONTHLY | QUARTERLY                  │
│  ├── MeteringAnnex ─────────── measurement rules                    │
│  ├── ContractParty[] ───────── buyer, seller, signatory             │
│  ├── ContractAsset[] ───────── linked assets with share             │
│  ├── Amendment[] ───────────── version changes                      │
│  └── Lifecycle State ───────── status machine                       │
│                                                                     │
│  3-Layer Structure:                                                 │
│  Master PPA → Commercial Schedule → Metering Annex                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         PRICING DOMAIN                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PricingPlan                                                        │
│  ├── Fixed ────────────────── rate × energy                         │
│  ├── Market Index ─────────── index × multiplier ± differential     │
│  ├── Hybrid ───────────────── fixed% × rate + market% × index      │
│  └── Floor ────────────────── max(base, minimum guarantee)          │
│                                                                     │
│  PricingEngine (separate from ContractEngine):                      │
│  Input:  energy, period, pricing plan version, market index         │
│  Output: unit price, base amount, formula explanation               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       METERING DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MeterReading                                                       │
│  ├── Asset ────────────────── power plant                           │
│  ├── Meter ────────────────── which meter                           │
│  ├── Period ───────────────── start/end date                        │
│  ├── Raw Energy ───────────── registered value                      │
│  ├── Accepted Energy ──────── after validation                      │
│  └── Status ───────────────── RAW → VALIDATED → ACCEPTED/REJECTED  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       SETTLEMENT DOMAIN                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Settlement                                                         │
│  ├── Reference ────────────── Contract + Asset + Period             │
│  ├── Energy ───────────────── accepted, rejected, reason            │
│  ├── Pricing ──────────────── plan version, unit price, base        │
│  ├── Adjustments[] ────────── fee, penalty, bonus, correction       │
│  ├── Result ───────────────── gross, deductions, tax, net           │
│  ├── Status ───────────────── CALCULATED → CONFIRMED → INVOICED     │
│  └── Dispute ──────────────── deadline, reason, resolution          │
│                                                                     │
│  Rule: Immutable after confirmation. Changes via adjustment only.   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        BILLING DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Invoice                                                            │
│  ├── Settlement ───────────── source (confirmed only)               │
│  ├── Amount ───────────────── total due                             │
│  ├── Status ───────────────── DRAFT → ISSUED → PAID                 │
│  └── Payment[] ────────────── payments received                     │
│                                                                     │
│  Rule: Invoice only from confirmed settlement.                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         PAYMENT DOMAIN                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Payment                                                            │
│  ├── Invoice ──────────────── linked invoice                        │
│  ├── Amount ───────────────── paid amount                           │
│  ├── Method ───────────────── bank transfer, wallet, ...            │
│  ├── Reference ────────────── transaction ID                        │
│  └── Allocation ───────────── how applied to invoices               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        NETTING DOMAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NettingGroup (optional, default OFF)                               │
│  ├── Party ────────────────── owner of all flows                    │
│  ├── Mode ─────────────────── OFF | AUTO | MANUAL                   │
│  ├── Type ─────────────────── FINANCIAL | ENERGY                    │
│  ├── Contracts[] ──────────── member contracts                      │
│  └── Result ───────────────── net amount for payment                │
│                                                                     │
│  Rules:                                                             │
│  - Same party only (no cross-party netting in v1)                   │
│  - Same currency required                                           │
│  - Underlying settlements always visible                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        AUDIT DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AuditLog                                                           │
│  ├── EntityType ───────────── Party, Asset, Contract, ...           │
│  ├── EntityId ─────────────── record ID                             │
│  ├── Action ───────────────── CREATE | UPDATE | DELETE | STATUS     │
│  ├── UserId ───────────────── who performed                         │
│  ├── Changes ──────────────── old → new values                      │
│  └── Timestamp ────────────── when                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Relationships

| From | To | Cardinality | Description |
|------|----|-------------|-------------|
| Party | Asset | 1:N | One party owns many assets |
| Party | User | 1:N | One party has many users |
| Party | BusinessRelation | 1:N | One party has many relations |
| Asset | Meter | 1:N | One asset has main + backup meters |
| Asset | ContractAsset | M:N | Asset in multiple contracts (capacity control) |
| Contract | ContractParty | 1:N | Contract has buyer, seller, signatory |
| Contract | CommercialSchedule | 1:N | One PPA, multiple schedules |
| CommercialSchedule | Asset | N:1 | Schedule linked to one asset |
| CommercialSchedule | PricingPlan | N:1 | Schedule uses one pricing plan |
| Request | Party | N:1 | Request belongs to one party |
| Request | Asset | N:1 | Request linked to one asset (optional initially) |
| Settlement | Contract | N:1 | Settlement per contract |
| Settlement | Asset | N:1 | Settlement per asset |
| Invoice | Settlement | 1:1 | One invoice per settlement |
| Invoice | Payment | 1:N | Invoice paid in multiple payments |
| NettingGroup | Contract | M:N | Contracts in netting group |
