# VPP — Phase 0: Domain Analysis & Consolidation

## Objective
Define all entities, relationships, states, routes, and pages before writing any code.

## Deliverables
| # | Document | File |
|---|----------|------|
| 1 | Domain Map | `01-domain-map.md` |
| 2 | ERD (Prisma Schema) | `02-erd.prisma` |
| 3 | State Machine — Request | `03-state-machine-request.md` |
| 4 | State Machine — Contract | `04-state-machine-contract.md` |
| 5 | State Machine — Settlement | `05-state-machine-settlement.md` |
| 6 | Status Matrix | `06-status-matrix.md` |
| 7 | Route Map | `07-route-map.md` |
| 8 | Page Map | `08-page-map.md` |
| 9 | Access Matrix | `09-access-matrix.md` |

## Key Decisions (from PRD)
1. Single Next.js app, two UIs (customer + admin)
2. Asset is independent from Party
3. Contract Engine ≠ Pricing Engine
4. Settlement ≠ Invoice
5. Netting is optional, default OFF
6. Every amount traceable to: Party → Workspace → Contract → Asset → Period
7. Small vs Large plant: same model, different data volume
8. Initial request is short and frictionless

## Core Entities
```
Party → BusinessRelation → User
Party → Asset → Meter → MeterReading
Request → Party + Asset
Contract → Party + Asset + CommercialSchedule + PricingPlan
Settlement → Contract + Asset + Period → Invoice → Payment
NettingGroup → Contracts (optional)
```
