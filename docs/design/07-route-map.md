# VPP — Route Map

## Overview
Complete routing structure for both Customer and Admin UIs.

## Root Routes

```
/                               # Landing page (selector)
├── /customer                   # Customer UI
└── /admin                      # Admin/Staff UI
```

## Customer Routes

```
/customer
│
├── /dashboard                          # Dashboard
│
├── /requests                           # My Requests (list)
│   ├── /new                            # New Request Form (initial)
│   └── /[id]                           # Request Detail
│       ├── /complete                   # Complete Information Form
│       ├── /documents                  # Upload Documents
│       └── /timeline                   # View Timeline
│
├── /assets                             # My Assets (list)
│   └── /[id]                           # Asset Detail
│
├── /contracts                          # My Contracts (list)
│   └── /[id]                           # Contract Detail
│       ├── /terms                      # Terms View
│       ├── /assets                     # Connected Assets
│       ├── /pricing                    # Pricing Details
│       └── /amendments                 # Amendments List
│
├── /proposals                          # My Proposals (list)
│   └── /[id]                           # Proposal Detail
│
├── /settlements                        # My Settlements (list)
│   └── /[id]                           # Settlement Detail
│       └── /dispute                    # Submit Dispute
│
├── /invoices                           # My Invoices (list)
│   └── /[id]                           # Invoice Detail
│
├── /payments                           # My Payments (list)
│   └── /[id]                           # Payment Detail
│
├── /notifications                      # Notifications Center
│
├── /profile                            # My Profile
│   ├── /edit                           # Edit Profile
│   └── /bank                           # Bank Information
│
└── /workspace                          # Workspace Settings
    └── /switch                         # Switch Party Context
```

## Admin Routes

```
/admin
│
├── /dashboard                          # Operations Dashboard
│
├── /requests                           # Request Queue
│   └── /[id]                           # Request Detail
│       ├── /review                     # Initial Review Form
│       ├── /info-review                # Information Review
│       ├── /ownership                  # Ownership Review
│       └── /assign                     # Assign to Staff
│
├── /parties                            # Parties List
│   └── /[id]                           # Party Detail
│       ├── /relations                  # Business Relations
│       └── /users                      # Party Users
│
├── /assets                             # Assets List
│   └── /[id]                           # Asset Detail
│       ├── /meters                     # Meters Management
│       ├── /profile                    # Generation Profile
│       └── /documents                  # Asset Documents
│
├── /contracts                          # Contracts List
│   └── /[id]                           # Contract Detail
│       ├── /configure                  # Contract Configurator (8-step wizard)
│       │   ├── /step-1                 # Parties
│       │   ├── /step-2                 # Asset
│       │   ├── /step-3                 # Duration & Volume
│       │   ├── /step-4                 # Pricing
│       │   ├── /step-5                 # Metering
│       │   ├── /step-6                 # Settlement
│       │   ├── /step-7                 # Netting
│       │   └── /step-8                 # Review & Confirm
│       ├── /amendments                 # Amendments List
│       └── /amendments/new             # Create Amendment
│
├── /proposals                          # Proposals List
│   ├── /new/[requestId]               # Create Proposal
│   └── /[id]                           # Proposal Detail
│
├── /pricing                            # Pricing Plans List
│   ├── /new                            # Create Pricing Plan
│   └── /[id]                           # Plan Detail
│       └── /versions                   # Version History
│
├── /metering                           # Meter Readings
│   ├── /import                         # Import Readings (CSV/API)
│   └── /[id]                           # Reading Detail
│
├── /settlements                        # Settlements List
│   ├── /pending                        # Pending Review
│   └── /[id]                           # Settlement Detail
│       └── /adjust                     # Create Adjustment
│
├── /invoices                           # Invoices List
│   ├── /new/[settlementId]            # Generate Invoice
│   └── /[id]                           # Invoice Detail
│
├── /payments                           # Payments List
│   └── /[id]                           # Payment Detail
│       └── /allocate                   # Allocate Payment
│
├── /netting                            # Netting Groups
│   ├── /new                            # Create Netting Group
│   ├── /[id]                           # Group Detail
│   └── /calculate                      # Run Netting Calculation
│
├── /reports                            # Reports
│   ├── /requests                       # Request Reports
│   ├── /contracts                      # Contract Reports
│   ├── /settlements                    # Settlement Reports
│   └── /financial                      # Financial Reports
│
├── /notifications                      # Notification Center
│   └── /templates                      # Notification Templates
│
├── /audit-log                          # Audit Trail
│   └── /[entityType]/[id]             # Entity Audit History
│
├── /settings                           # System Settings
│   ├── /roles                          # Role Management
│   ├── /users                          # User Management
│   ├── /regions                        # Region/City Management
│   └── /system                         # System Configuration
│
└── /workspace                          # Workspace Management
    └── /switch                         # Switch Context
```

## API Routes (Future)

```
/api
├── /v1
│   ├── /parties                        # Party CRUD
│   ├── /assets                         # Asset CRUD
│   ├── /requests                       # Request CRUD + workflow
│   ├── /contracts                      # Contract CRUD + lifecycle
│   ├── /pricing                        # Pricing Plan CRUD
│   ├── /metering                       # Meter Reading CRUD
│   ├── /settlements                    # Settlement CRUD + workflow
│   ├── /invoices                       # Invoice CRUD
│   ├── /payments                       # Payment CRUD
│   ├── /netting                        # Netting operations
│   ├── /reports                        # Report generation
│   └── /auth                           # Authentication
│
└── /webhooks                           # External system callbacks
    ├── /metering                       # Meter data webhook
    └── /payment                        # Payment confirmation webhook
```

## Route Protection (Phase 8)

| Route | Auth Required | Role Required |
|-------|---------------|---------------|
| `/` | No | — |
| `/customer/*` | Yes | CUSTOMER |
| `/admin/*` | Yes | ADMIN, STAFF_* |
| `/api/v1/*` | Yes | Varies by endpoint |

## Dynamic Route Patterns

```
[partyId]     # Party identifier
[assetId]     # Asset identifier  
[requestId]   # Request/Case identifier
[contractId]  # Contract identifier
[settlementId] # Settlement identifier
[invoiceId]   # Invoice identifier
[paymentId]   # Payment identifier
[userId]      # User identifier
[periodStart] # Period start date
[periodEnd]   # Period end date
```
