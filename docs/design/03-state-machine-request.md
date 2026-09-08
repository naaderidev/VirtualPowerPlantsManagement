# VPP — State Machine: Request (Case)

## Overview
The Request (Case) is the entry point for all seller interactions. It tracks the journey from initial inquiry to active contract.

## States

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REQUEST STATES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DRAFT                                                              │
│    │                                                                │
│    ▼                                                                │
│  SUBMITTED ──────────────────────────────────────────────┐          │
│    │                                                     │          │
│    ▼                                                     │          │
│  INITIAL_REVIEW ─────────────────────────────────┐      │          │
│    │                                             │      │          │
│    ├──→ NEEDS_INFORMATION ──→ INFORMATION_SUBMITTED ─┐  │          │
│    │         │                                      │  │          │
│    │         ▼                                      │  │          │
│    │    (back to INITIAL_REVIEW) ◄─────────────────┘  │          │
│    │                                                  │          │
│    ├──→ DEFERRED (with follow-up date)                │          │
│    │         │                                        │          │
│    │         └──→ SUBMITTED (on follow-up date) ──────┘          │
│    │                                                             │
│    ├──→ REJECTED ──→ CLOSED                                      │
│    │                                                             │
│    ▼                                                             │
│  APPROVED                                                        │
│    │                                                             │
│    ▼                                                             │
│  OWNERSHIP_REVIEW ──────────────────────────────┐               │
│    │                                            │               │
│    ├──→ NEEDS_INFO ──→ INFORMATION_SUBMITTED ─┐ │               │
│    │         │                                │ │               │
│    │         ▼                                │ │               │
│    │    (back to OWNERSHIP_REVIEW) ◄──────────┘ │               │
│    │                                            │               │
│    ├──→ REJECTED ──→ CLOSED                     │               │
│    │                                            │               │
│    ▼                                            │               │
│  PROPOSAL_PENDING                               │               │
│    │                                            │               │
│    ▼                                            │               │
│  PROPOSAL_READY                                 │               │
│    │                                            │               │
│    ├──→ PROPOSAL_ACCEPTED                       │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    CONTRACT_PENDING                        │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    CONTRACT_SIGNED                         │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    ACTIVE                                  │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    SETTLEMENT_PENDING                      │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    SETTLED                                 │               │
│    │         │                                  │               │
│    │         ▼                                  │               │
│    │    COMPLETED                               │               │
│    │                                            │               │
│    └──→ PROPOSAL_REJECTED ──→ CLOSED            │               │
│                                                                     │
│  CANCELLED (from any pre-ACTIVE state)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## State Definitions

| State | Description | Who Sets | Customer Sees |
|-------|-------------|----------|---------------|
| DRAFT | Form started but not submitted | System | "پیش‌نویس درخواست" |
| SUBMITTED | Initial request submitted | Customer | "درخواست ارسال شد" |
| INITIAL_REVIEW | Being reviewed by supply team | System | "در حال بررسی برقتو" |
| NEEDS_INFORMATION | Additional info requested | Admin | "نیاز به اطلاعات تکمیلی" |
| INFORMATION_SUBMITTED | Info provided by customer | Customer | "اطلاعات ارسال شد" |
| DEFERRED | Follow-up scheduled for later | Admin | "پیگیری در آینده" |
| REJECTED | Not suitable for purchase | Admin | "رد شده" |
| APPROVED | Initial review passed | Admin | "تأیید اولیه" |
| OWNERSHIP_REVIEW | Ownership and docs being verified | Admin | "بررسی مالکیت" |
| PROPOSAL_PENDING | Pricing proposal being prepared | Admin | "در حال تهیه پیشنهاد" |
| PROPOSAL_READY | Proposal sent to customer | Admin | "پیشنهاد آماده است" |
| PROPOSAL_ACCEPTED | Customer accepted proposal | Customer | "پیشنهاد پذیرفته شد" |
| PROPOSAL_REJECTED | Customer rejected proposal | Customer | "پیشنهاد رد شد" |
| CONTRACT_PENDING | Contract being configured | Admin | "قرارداد در حال تنظیم" |
| CONTRACT_SIGNED | Contract signed by both parties | System | "قرارداد امضا شد" |
| ACTIVE | Contract is active, delivery started | System | "قرارداد فعال" |
| SETTLEMENT_PENDING | Settlement being calculated | System | "تسویه در حال محاسبه" |
| SETTLED | Settlement confirmed | System | "تسویه تأیید شد" |
| COMPLETED | All payments done | System | "تکمیل شده" |
| CANCELLED | Request cancelled | Customer/Admin | "لغو شده" |
| CLOSED | Terminal state (rejected/deferred expired) | System | "بسته شده" |

## Allowed Transitions

```
FROM → TO (Actor)
─────────────────────────────────────────────────────
DRAFT → SUBMITTED (Customer)
SUBMITTED → INITIAL_REVIEW (System - auto)
INITIAL_REVIEW → NEEDS_INFORMATION (Admin)
INITIAL_REVIEW → DEFERRED (Admin)
INITIAL_REVIEW → REJECTED (Admin)
INITIAL_REVIEW → APPROVED (Admin)
NEEDS_INFORMATION → INFORMATION_SUBMITTED (Customer)
INFORMATION_SUBMITTED → INITIAL_REVIEW (System - auto)
DEFERRED → SUBMITTED (System - on follow-up date)
APPROVED → OWNERSHIP_REVIEW (System - auto)
OWNERSHIP_REVIEW → NEEDS_INFO (Admin)
OWNERSHIP_REVIEW → REJECTED (Admin)
OWNERSHIP_REVIEW → PROPOSAL_PENDING (Admin)
NEEDS_INFO → INFORMATION_SUBMITTED (Customer)
INFORMATION_SUBMITTED → OWNERSHIP_REVIEW (System - auto)
PROPOSAL_PENDING → PROPOSAL_READY (Admin)
PROPOSAL_READY → PROPOSAL_ACCEPTED (Customer)
PROPOSAL_READY → PROPOSAL_REJECTED (Customer)
PROPOSAL_ACCEPTED → CONTRACT_PENDING (System - auto)
CONTRACT_PENDING → CONTRACT_SIGNED (System - on sign)
CONTRACT_SIGNED → ACTIVE (System - on effective date)
ACTIVE → SETTLEMENT_PENDING (System - per cycle)
SETTLEMENT_PENDING → SETTLED (Admin)
SETTLED → COMPLETED (System - when fully paid)

// Cancellation (from any pre-ACTIVE state)
DRAFT → CANCELLED (Customer)
SUBMITTED → CANCELLED (Customer/Admin)
INITIAL_REVIEW → CANCELLED (Admin)
APPROVED → CANCELLED (Admin)
OWNERSHIP_REVIEW → CANCELLED (Admin)
PROPOSAL_PENDING → CANCELLED (Admin)
PROPOSAL_READY → CANCELLED (Admin)
CONTRACT_PENDING → CANCELLED (Admin)
```

## Customer-Facing Status Mapping

| Internal State | Customer Sees | Customer CTA |
|----------------|---------------|--------------|
| DRAFT | پیش‌نویس | تکمیل و ارسال |
| SUBMITTED | درخواست ارسال شد | انتظار بررسی |
| INITIAL_REVIEW | در حال بررسی | انتظار بررسی |
| NEEDS_INFORMATION | نیاز به اطلاعات | تکمیل اطلاعات |
| DEFERRED | پیگیری در آینده | انتظار |
| REJECTED | رد شده | — |
| APPROVED | تأیید شده | انتظار بررسی مالکیت |
| OWNERSHIP_REVIEW | بررسی مالکیت | تکمیل مدارک |
| PROPOSAL_PENDING | در حال تهیه پیشنهاد | انتظار |
| PROPOSAL_READY | پیشنهاد آماده | مشاهده پیشنهاد |
| PROPOSAL_ACCEPTED | پذیرفته شده | انتظار قرارداد |
| PROPOSAL_REJECTED | رد شده | — |
| CONTRACT_PENDING | قرارداد در حال تنظیم | انتظار |
| CONTRACT_SIGNED | امضا شده | مشاهده قرارداد |
| ACTIVE | فعال | مشاهده جزئیات |
| SETTLEMENT_PENDING | تسویه در حال محاسبه | مشاهده |
| SETTLED | تسویه شده | مشاهده جزئیات |
| COMPLETED | تکمیل شده | — |
| CANCELLED | لغو شده | — |

## Notifications Triggered by State Changes

| Transition | Notification |
|------------|--------------|
| → SUBMITTED | "درخواست شما ثبت شد. شماره پیگیری: {caseNumber}" |
| → NEEDS_INFORMATION | "اطلاعات تکمیلی مورد نیاز است" |
| → APPROVED | "درخواست شما تأیید اولیه شد" |
| → REJECTED | "درخواست شما رد شد. دلیل: {reason}" |
| → PROPOSAL_READY | "پیشنهاد قیمت آماده است" |
| → CONTRACT_PENDING | "قرارداد در حال تنظیم است" |
| → CONTRACT_SIGNED | "قرارداد امضا شد" |
| → SETTLEMENT_PENDING | "تسویه دوره {period} در حال محاسبه" |
| → SETTLED | "تسویه تأیید شد. مبلغ: {amount}" |
