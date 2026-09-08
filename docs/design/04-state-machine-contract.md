# VPP — State Machine: Contract

## Overview
Contract lifecycle from draft to active/terminated. The Contract Engine is separate from the Pricing Engine.

## States

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTRACT STATES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DRAFT                                                              │
│    │                                                                │
│    ▼                                                                │
│  CONFIGURED                                                         │
│    │                                                                │
│    ▼                                                                │
│  INTERNAL_REVIEW ──────────────────────────────────┐               │
│    │                                               │               │
│    ├──→ NEEDS_CHANGES ──→ CONFIGURED ◄─────────────┘               │
│    │                                                                │
│    ├──→ REJECTED ──→ CLOSED                                         │
│    │                                                                │
│    ▼                                                                │
│  PENDING_SIGNATURE                                                  │
│    │                                                                │
│    ├──→ SIGNED                                                      │
│    │     │                                                          │
│    │     ▼                                                          │
│    │   ACTIVE ─────────────────────────────────────────┐           │
│    │     │                                             │           │
│    │     ├──→ AMENDMENT_PENDING ──→ AMENDMENT_SIGNED ──┤           │
│    │     │         │                                    │           │
│    │     │         └──→ ACTIVE (new version) ◄──────────┘           │
│    │     │                                                         │
│    │     ├──→ TERMINATION_PENDING ──→ TERMINATED                   │
│    │     │                                                         │
│    │     └──→ EXPIRED (on expiration date)                         │
│    │                                                               │
│    └──→ CANCELLED                                                  │
│                                                                     │
│  CLOSED (terminal)                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## State Definitions

| State | Description | Who Sets | Duration |
|-------|-------------|----------|----------|
| DRAFT | Contract created, not yet configured | Admin | Minutes-Hours |
| CONFIGURED | All settings complete, ready for review | Admin | Hours-Days |
| INTERNAL_REVIEW | Being reviewed by legal/management | System | Days |
| NEEDS_CHANGES | Changes requested during review | Admin/Legal | Days |
| PENDING_SIGNATURE | Sent for signatures | Admin | Days-Weeks |
| SIGNED | Both parties signed | System | — |
| ACTIVE | Contract is in effect | System | Months-Years |
| AMENDMENT_PENDING | Amendment being prepared | Admin | Days |
| TERMINATION_PENDING | Termination requested | Admin | Days |
| TERMINATED | Contract terminated early | System | — |
| EXPIRED | Contract reached end date | System | — |
| REJECTED | Contract rejected during review | Admin/Legal | — |
| CANCELLED | Contract cancelled before signing | Admin | — |
| CLOSED | Terminal state | System | — |

## Allowed Transitions

```
FROM → TO (Actor)
─────────────────────────────────────────────────────
DRAFT → CONFIGURED (Admin)
DRAFT → CANCELLED (Admin)

CONFIGURED → INTERNAL_REVIEW (Admin)
CONFIGURED → CANCELLED (Admin)

INTERNAL_REVIEW → NEEDS_CHANGES (Legal/Manager)
INTERNAL_REVIEW → PENDING_SIGNATURE (Legal/Manager)
INTERNAL_REVIEW → REJECTED (Legal/Manager)

NEEDS_CHANGES → CONFIGURED (Admin)

PENDING_SIGNATURE → SIGNED (System - on both signatures)
PENDING_SIGNATURE → CANCELLED (Admin)

SIGNED → ACTIVE (System - on effective date)

ACTIVE → AMENDMENT_PENDING (Admin)
ACTIVE → TERMINATION_PENDING (Admin/Manager)

AMENDMENT_PENDING → ACTIVE (System - on approval + signature)
AMENDMENT_PENDING → NEEDS_CHANGES (Legal)

TERMINATION_PENDING → TERMINATED (System - on effective date)
TERMINATION_PENDING → ACTIVE (Admin - if cancelled)

// Auto-transitions
ACTIVE → EXPIRED (System - on expiration date if not terminated)
```

## Contract Versioning

- Each amendment creates a new version
- Version number increments: 1, 2, 3, ...
- Previous versions remain immutable
- Active contract always references latest approved version
- Amendments link to parent version

## Contract Structure (3-Layer)

```
Layer 1: Master Power Purchase Agreement (PPA)
├── Fixed legal terms
├── Parties and obligations
├── Confidentiality, dispute resolution
└── Long-term, shared across multiple schedules

Layer 2: Commercial Schedule
├── Per-asset terms
├── Duration, volume, pricing plan
├── Settlement cycle, payment terms
└── Multiple schedules per Master PPA

Layer 3: Metering & Settlement Annex
├── Measurement rules
├── Missing data policy
├── Correction deadlines
└── Dispute process
```

## Contract ↔ Asset Rules

| Rule | Description |
|------|-------------|
| Capacity Control | Sum of active contract volumes ≤ asset sellable capacity |
| Share Percentage | Each contract-asset link has optional share % |
| Amendment Impact | Amendment may change asset links or volumes |
| Termination | Terminating one schedule doesn't affect others |

## Customer-Facing Status

| Internal State | Customer Sees | CTA |
|----------------|---------------|-----|
| DRAFT | در حال تنظیم | — |
| CONFIGURED | در حال بررسی داخلی | انتظار |
| INTERNAL_REVIEW | در حال بررسی | انتظار |
| NEEDS_CHANGES | نیاز به اصلاح | — |
| PENDING_SIGNATURE | منتظر امضای شما | امضای قرارداد |
| SIGNED | امضا شده | انتظار فعال‌سازی |
| ACTIVE | فعال | مشاهده جزئیات |
| AMENDMENT_PENDING | الحاقیه در حال بررسی | مشاهده |
| TERMINATION_PENDING | در حال فسخ | — |
| TERMINATED | فسخ شده | — |
| EXPIRED | منقضی شده | — |
