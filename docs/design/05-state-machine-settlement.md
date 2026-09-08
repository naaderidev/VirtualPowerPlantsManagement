# VPP — State Machine: Settlement

## Overview
Settlement is the calculation of amount due for a delivery period. It is separate from Invoice (financial document) and Metering (data collection).

## States

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SETTLEMENT STATES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CALCULATED                                                         │
│    │  (initial state after PricingEngine runs)                      │
│    │                                                                │
│    ▼                                                                │
│  DRAFT                                                              │
│    │  (auto-move after calculation)                                 │
│    │                                                                │
│    ▼                                                                │
│  UNDER_REVIEW ────────────────────────────────────┐                │
│    │                                              │                │
│    ├──→ CONFIRMED                                 │                │
│    │       │                                      │                │
│    │       ▼                                      │                │
│    │    INVOICED                                  │                │
│    │       │                                      │                │
│    │       ▼                                      │                │
│    │    PAID                                      │                │
│    │                                              │                │
│    ├──→ DISPUTED                                  │                │
│    │       │                                      │                │
│    │       ├──→ ADJUSTMENT ──→ CALCULATED ◄───────┘                │
│    │       │       │ (new version)                                  │
│    │       │       ▼                                                │
│    │       │    UNDER_REVIEW                                        │
│    │       │                                                        │
│    │       └──→ REJECTED ──→ RECALCULATED ──→ CALCULATED           │
│    │                                                                │
│    └──→ REJECTED (by admin) ──→ RECALCULATED                       │
│                                                                     │
│  PAID (terminal - or close to it)                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## State Definitions

| State | Description | Who Sets |
|-------|-------------|----------|
| CALCULATED | PricingEngine computed result | System (auto) |
| DRAFT | Ready for review, adjustments possible | System (auto) |
| UNDER_REVIEW | Being reviewed by admin/customer | Admin |
| CONFIRMED | Approved, ready for invoicing | Admin |
| INVOICED | Invoice generated from this settlement | System (auto) |
| PAID | Payment received and allocated | System (auto) |
| DISPUTED | Customer raised dispute | Customer/Admin |
| ADJUSTMENT | Amendment being processed | Admin |
| REJECTED | Settlement rejected, needs recalculation | Admin |
| RECALCULATED | Being recalculated | System |

## Allowed Transitions

```
FROM → TO (Actor)
─────────────────────────────────────────────────────
CALCULATED → DRAFT (System - auto)
DRAFT → UNDER_REVIEW (System - auto or Admin)
UNDER_REVIEW → CONFIRMED (Admin)
UNDER_REVIEW → DISPUTED (Customer/Admin)
UNDER_REVIEW → REJECTED (Admin)
CONFIRMED → INVOICED (System - on invoice creation)
INVOICED → PAID (System - on payment allocation)
DISPUTED → ADJUSTMENT (Admin)
ADJUSTMENT → CALCULATED (System - new version)
REJECTED → RECALCULATED (System)
RECALCULATED → CALCULATED (System)
```

## Settlement Versioning

- Each adjustment creates a new version
- Version 1 → adjustment → Version 2
- Previous versions remain immutable
- Settlement number stays same, version increments
- Audit trail: who changed what, when, why

## Adjustment Types

| Type | Description | Example |
|------|-------------|---------|
| CORRECTION | Fix meter reading error | Reading was 1000, corrected to 1050 |
| PENALTY | Penalty for non-compliance | Late delivery penalty |
| BONUS | Performance bonus | Above-expected generation |
| FEE | Service fee | Meter maintenance fee |
| TAX_ADJUSTMENT | Tax correction | New tax rate applied |
| CREDIT | Credit for overpayment | Previous overpayment credit |

## Settlement ↔ Invoice Rule

```
Rule: Invoice ONLY from CONFIRMED Settlement

Settlement (CONFIRMED) → Invoice (DRAFT)
                              │
                              ▼
                         Invoice (ISSUED)

If Settlement changes after invoicing:
1. Create adjustment on original settlement
2. New Settlement version created
3. New Invoice created from new settlement
4. Old Invoice marked as CANCELLED or CREDITED
```

## Customer-Facing View

| Internal State | Customer Sees | CTA |
|----------------|---------------|-----|
| CALCULATED | در حال آماده‌سازی | مشاهده پیش‌نویس |
| DRAFT | پیش‌نویس آماده | بررسی |
| UNDER_REVIEW | در حال بررسی | بررسی جزئیات |
| CONFIRMED | تأیید شده | انتظار صورتحساب |
| INVOICED | صورتحساب صادر شده | مشاهده صورتحساب |
| PAID | پرداخت شده | مشاهده رسید |
| DISPUTED | مورد اعتراض | پیگیری |
| ADJUSTED | اصلاح شده | مشاهده نسخه جدید |

## Dispute Flow

```
Customer views settlement
  │
  ├── agrees → CONFIRMED
  │
  └── disputes → DISPUTED
        │
        ├── provides reason
        │
        ├── admin reviews
        │     │
        │     ├── rejects dispute → back to UNDER_REVIEW
        │     │
        │     └── accepts dispute → ADJUSTMENT
        │           │
        │           ├── correction applied
        │           │
        │           └── new version CALCULATED → DRAFT → ...
        │
        └── dispute deadline: {disputeDeadline} days after settlement
```

## Settlement Traceability

Every settlement must be traceable to:
```
Party (who)
  └── Workspace (which business context)
       └── Contract (under what agreement)
            └── Asset (for which power plant)
                 └── Period (for which delivery period)
```

This is enforced by the schema:
```
Settlement {
  contractId → Contract
  assetId → Asset
  periodStart, periodEnd → Period
}
```
