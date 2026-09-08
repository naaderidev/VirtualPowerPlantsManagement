# VPP — Access Matrix

## Overview
Role-based access control for Phase 8 implementation.

## Roles

### System Roles
| Role | Description |
|------|-------------|
| ADMIN | Full system access |
| STAFF_SUPPLY | Supply chain operators |
| STAFF_TECHNICAL | Technical reviewers |
| STAFF_LEGAL | Legal team |
| STAFF_FINANCIAL | Financial team |
| MANAGER | Management / approvals |
| CUSTOMER | End customer (seller) |
| CUSTOMER_REPRESENTATIVE | Company representative |

### Business Relation Types
| Type | Description |
|------|-------------|
| SELLER | Sells power to Bartoo |
| BUYER | Buys power from Bartoo |
| INSTALLER | Installs equipment |
| CONTRACTOR | Construction/maintenance |
| CONSULTANT | Advisory services |
| MAINTAINER | Ongoing maintenance |

## Entity Access Matrix

### Party

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | ✓ | - | - | - | - | ✓ | - |
| Read All | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Read Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update | ✓ | ✓* | - | ✓* | - | ✓ | ✓* | ✓* |
| Delete | ✓ | - | - | - | - | - | - | - |
| View Financial | ✓ | - | - | - | ✓ | ✓ | ✓** | ✓** |

\* Limited to own scope
\** Only for own party

### Asset

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | ✓ | ✓ | - | - | - | ✓ | ✓ |
| Read All | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Read Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update | ✓ | ✓ | ✓ | - | - | ✓ | ✓* | ✓* |
| Delete | ✓ | - | - | - | - | - | - | - |
| View Documents | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| Upload Docs | ✓ | ✓ | ✓ | - | - | - | ✓ | ✓ |
| Approve | ✓ | - | ✓ | - | - | ✓ | - | - |

\* Limited to own assets

### Request

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | - | - | - | - | - | - | ✓ | ✓ |
| Read All | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Read Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Initial Review | ✓ | ✓ | - | - | - | - | - | - |
| Approve | ✓ | ✓ | - | - | - | ✓ | - | - |
| Reject | ✓ | ✓ | - | - | - | ✓ | - | - |
| Request Info | ✓ | ✓ | - | - | - | - | - | - |
| Defer | ✓ | ✓ | - | - | - | - | - | - |
| Ownership Review | ✓ | - | ✓ | ✓ | - | - | - | - |
| Complete Info | ✓ | - | - | - | - | - | ✓ | ✓ |
| Upload Docs | ✓ | - | - | - | - | - | ✓ | ✓ |
| Assign | ✓ | ✓ | - | - | - | ✓ | - | - |

### Contract

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | ✓ | - | - | - | - | - | - |
| Read All | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Read Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configure | ✓ | ✓ | - | - | - | - | - | - |
| Internal Review | ✓ | - | - | ✓ | - | ✓ | - | - |
| Approve | ✓ | - | - | ✓ | - | ✓ | - | - |
| Send for Signature | ✓ | ✓ | - | ✓ | - | ✓ | - | - |
| Sign | ✓ | - | - | - | - | - | ✓ | ✓ |
| Amend | ✓ | ✓ | - | ✓ | - | ✓ | - | - |
| Terminate | ✓ | - | - | ✓ | - | ✓ | - | - |
| View Terms | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Pricing | ✓ | ✓ | - | - | ✓ | ✓ | ✓ | ✓ |

### Pricing Plan

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | ✓ | - | - | - | - | - | - |
| Read All | ✓ | ✓ | - | - | ✓ | ✓ | - | - |
| Read Active | ✓ | ✓ | - | - | ✓ | ✓ | ✓ | ✓ |
| Update | ✓ | ✓ | - | - | - | - | - | - |
| Approve | ✓ | - | - | - | - | ✓ | - | - |
| Deprecate | ✓ | ✓ | - | - | - | ✓ | - | - |

### Meter Reading

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create (Import) | ✓ | ✓ | ✓ | - | - | - | - | - |
| Read All | ✓ | ✓ | ✓ | - | ✓ | ✓ | - | - |
| Read Own Assets | ✓ | ✓ | ✓ | - | ✓ | ✓ | ✓ | ✓ |
| Validate | ✓ | ✓ | ✓ | - | - | - | - | - |
| Accept | ✓ | ✓ | - | - | - | - | - | - |
| Reject | ✓ | ✓ | ✓ | - | - | - | - | - |
| Adjust | ✓ | ✓ | - | - | - | ✓ | - | - |

### Settlement

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Calculate | ✓ | - | - | - | - | - | - | - |
| Read All | ✓ | - | - | - | ✓ | ✓ | - | - |
| Read Own | ✓ | - | - | - | ✓ | ✓ | ✓ | ✓ |
| Review | ✓ | - | - | - | ✓ | ✓ | - | - |
| Confirm | ✓ | - | - | - | ✓ | ✓ | - | - |
| Dispute | - | - | - | - | - | - | ✓ | ✓ |
| Adjust | ✓ | - | - | - | ✓ | ✓ | - | - |
| Reject | ✓ | - | - | - | - | ✓ | - | - |

### Invoice

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | - | - | - | ✓ | - | - | - |
| Read All | ✓ | - | - | - | ✓ | ✓ | - | - |
| Read Own | ✓ | - | - | - | ✓ | ✓ | ✓ | ✓ |
| Issue | ✓ | - | - | - | ✓ | - | - | - |
| Cancel | ✓ | - | - | - | ✓ | ✓ | - | - |

### Payment

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Record | ✓ | - | - | - | ✓ | - | - | - |
| Read All | ✓ | - | - | - | ✓ | ✓ | - | - |
| Read Own | ✓ | - | - | - | ✓ | ✓ | ✓ | ✓ |
| Allocate | ✓ | - | - | - | ✓ | - | - | - |

### Netting Group

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Create | ✓ | - | - | - | ✓ | ✓ | - | - |
| Read | ✓ | - | - | - | ✓ | ✓ | - | - |
| Update | ✓ | - | - | - | ✓ | ✓ | - | - |
| Calculate | ✓ | - | - | - | ✓ | - | - | - |
| Activate | ✓ | - | - | - | ✓ | ✓ | - | - |

### Audit Log

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Read All | ✓ | - | - | - | - | ✓ | - | - |
| Read Entity | ✓ | ✓* | ✓* | ✓* | ✓* | ✓ | - | - |
| Read Own | ✓ | - | - | - | - | - | ✓ | ✓ |

\* Only for entities in their scope

### Notifications

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Read All | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Read Own | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configure | ✓ | - | - | - | - | - | - | - |

### Settings

| Action | ADMIN | STAFF_SUPPLY | STAFF_TECH | STAFF_LEGAL | STAFF_FIN | MANAGER | CUSTOMER | REP |
|--------|-------|--------------|------------|-------------|-----------|---------|----------|-----|
| Read | ✓ | - | - | - | - | ✓ | - | - |
| Update | ✓ | - | - | - | - | - | - | - |
| Manage Users | ✓ | - | - | - | - | - | - | - |
| Manage Roles | ✓ | - | - | - | - | - | - | - |

## Workspace Scoping

All data access is scoped to the active workspace:
- Customer sees only their party's data
- Staff sees data within their assigned scope
- Admin sees all data

```
Workspace = {
  partyId: string,
  businessRelationType: 'SELLER' | 'BUYER' | ...,
  active: boolean
}
```

## API Endpoint Access (Phase 8)

| Endpoint | Method | Roles |
|----------|--------|-------|
| `/api/v1/parties` | GET | ADMIN, STAFF_* |
| `/api/v1/parties/:id` | GET | ADMIN, STAFF_*, CUSTOMER (own) |
| `/api/v1/assets` | GET | ADMIN, STAFF_* |
| `/api/v1/assets/:id` | GET | ADMIN, STAFF_*, CUSTOMER (own) |
| `/api/v1/requests` | GET | ADMIN, STAFF_SUPPLY |
| `/api/v1/requests` | POST | CUSTOMER, REP |
| `/api/v1/requests/:id` | GET | ADMIN, STAFF_*, CUSTOMER (own) |
| `/api/v1/requests/:id/review` | POST | ADMIN, STAFF_SUPPLY, MANAGER |
| `/api/v1/contracts` | GET | ADMIN, STAFF_* |
| `/api/v1/contracts` | POST | ADMIN, STAFF_SUPPLY |
| `/api/v1/contracts/:id` | GET | ADMIN, STAFF_*, CUSTOMER (own) |
| `/api/v1/contracts/:id/configure` | PUT | ADMIN, STAFF_SUPPLY |
| `/api/v1/pricing` | GET | ADMIN, STAFF_*, CUSTOMER (active only) |
| `/api/v1/pricing` | POST | ADMIN, STAFF_SUPPLY |
| `/api/v1/metering` | GET | ADMIN, STAFF_* |
| `/api/v1/metering` | POST | ADMIN, STAFF_SUPPLY, STAFF_TECH |
| `/api/v1/settlements` | GET | ADMIN, STAFF_FIN, CUSTOMER (own) |
| `/api/v1/settlements/:id/confirm` | POST | ADMIN, STAFF_FIN, MANAGER |
| `/api/v1/settlements/:id/dispute` | POST | CUSTOMER, REP |
| `/api/v1/invoices` | GET | ADMIN, STAFF_FIN, CUSTOMER (own) |
| `/api/v1/invoices` | POST | ADMIN, STAFF_FIN |
| `/api/v1/payments` | GET | ADMIN, STAFF_FIN, CUSTOMER (own) |
| `/api/v1/payments` | POST | ADMIN, STAFF_FIN |
| `/api/v1/audit` | GET | ADMIN, MANAGER |
| `/api/v1/settings` | GET | ADMIN, MANAGER |
| `/api/v1/settings` | PUT | ADMIN |

## Permission Rules

1. **Data Isolation**: Customer can only see their own party's data
2. **Workspace Scope**: All queries filtered by active workspace
3. **Role Hierarchy**: ADMIN > MANAGER > STAFF_* > CUSTOMER
4. **Separation of Duties**: Financial approvals require STAFF_FIN or MANAGER
5. **Legal Review**: Contracts require STAFF_LEGAL approval
6. **Audit Trail**: All state changes logged with userId and timestamp
7. **Session Timeout**: Configurable inactivity timeout
8. **IP Whitelisting**: Optional for admin access (Phase 8+)
