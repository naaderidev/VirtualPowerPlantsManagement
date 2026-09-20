import {
  AUDIT_READ_ROLES,
  FINANCIAL_ROLES,
  INTERNAL_ROLES,
  METER_READING_ROLES,
  NETTING_READ_ROLES,
  PAYMENT_READ_ROLES,
  PRICING_USE_ROLES,
  PROPOSAL_MANAGE_ROLES,
  REQUEST_WRITE_ROLES,
  SUPPLY_ROLES,
  TECHNICAL_ROLES,
  type AppRole,
  roleIsAllowed,
} from "@/lib/access-control";

export type AdminNavigationKey =
  | "dashboard"
  | "requests"
  | "parties"
  | "representatives"
  | "assets"
  | "contracts"
  | "proposals"
  | "pricing"
  | "market-indices"
  | "pricing-engine"
  | "metering"
  | "meters-new"
  | "settlements"
  | "financial-configurations"
  | "invoices"
  | "payments"
  | "netting"
  | "reports"
  | "notifications"
  | "audit-log"
  | "settings"
  | "users";

export const ADMIN_NAVIGATION_ROLES: Record<AdminNavigationKey, readonly AppRole[]> = {
  dashboard: INTERNAL_ROLES,
  requests: INTERNAL_ROLES,
  parties: INTERNAL_ROLES,
  representatives: ["ADMIN"],
  assets: INTERNAL_ROLES,
  contracts: INTERNAL_ROLES,
  proposals: PROPOSAL_MANAGE_ROLES,
  pricing: PRICING_USE_ROLES,
  "market-indices": PRICING_USE_ROLES,
  "pricing-engine": PRICING_USE_ROLES,
  metering: METER_READING_ROLES,
  "meters-new": TECHNICAL_ROLES,
  settlements: FINANCIAL_ROLES,
  "financial-configurations": FINANCIAL_ROLES,
  invoices: FINANCIAL_ROLES,
  payments: PAYMENT_READ_ROLES,
  netting: NETTING_READ_ROLES,
  reports: FINANCIAL_ROLES,
  notifications: INTERNAL_ROLES,
  "audit-log": AUDIT_READ_ROLES,
  settings: ["ADMIN"],
  users: ["ADMIN"],
};

const ADMIN_ROUTE_RULES: Array<{ prefix: string; roles: readonly AppRole[] }> = [
  { prefix: "/admin/market-indices", roles: ADMIN_NAVIGATION_ROLES["market-indices"] },
  { prefix: "/admin/pricing-engine", roles: ADMIN_NAVIGATION_ROLES["pricing-engine"] },
  { prefix: "/admin/pricing", roles: ADMIN_NAVIGATION_ROLES.pricing },
  { prefix: "/admin/proposals", roles: ADMIN_NAVIGATION_ROLES.proposals },
  { prefix: "/admin/meters", roles: ADMIN_NAVIGATION_ROLES["meters-new"] },
  { prefix: "/admin/metering", roles: ADMIN_NAVIGATION_ROLES.metering },
  { prefix: "/admin/settlements", roles: ADMIN_NAVIGATION_ROLES.settlements },
  { prefix: "/admin/financial-configurations", roles: ADMIN_NAVIGATION_ROLES["financial-configurations"] },
  { prefix: "/admin/invoices", roles: ADMIN_NAVIGATION_ROLES.invoices },
  { prefix: "/admin/payments", roles: ADMIN_NAVIGATION_ROLES.payments },
  { prefix: "/admin/netting", roles: ADMIN_NAVIGATION_ROLES.netting },
  { prefix: "/admin/reports", roles: ADMIN_NAVIGATION_ROLES.reports },
  { prefix: "/admin/audit-log", roles: ADMIN_NAVIGATION_ROLES["audit-log"] },
  { prefix: "/admin/settings", roles: ADMIN_NAVIGATION_ROLES.settings },
  { prefix: "/admin/users", roles: ADMIN_NAVIGATION_ROLES.users },
  { prefix: "/admin/notifications", roles: ADMIN_NAVIGATION_ROLES.notifications },
  { prefix: "/admin/contracts", roles: ADMIN_NAVIGATION_ROLES.contracts },
  { prefix: "/admin/requests", roles: ADMIN_NAVIGATION_ROLES.requests },
  { prefix: "/admin/parties", roles: ADMIN_NAVIGATION_ROLES.parties },
  { prefix: "/admin/representatives", roles: ADMIN_NAVIGATION_ROLES.representatives },
  { prefix: "/admin/assets", roles: ADMIN_NAVIGATION_ROLES.assets },
  { prefix: "/admin/dashboard", roles: ADMIN_NAVIGATION_ROLES.dashboard },
];

const ADMIN_NESTED_ROUTE_RULES: Array<{ pattern: RegExp; roles: readonly AppRole[] }> = [
  { pattern: /^\/admin\/requests\/[^/]+\/proposal$/, roles: PROPOSAL_MANAGE_ROLES },
  { pattern: /^\/admin\/requests\/[^/]+\/contract$/, roles: SUPPLY_ROLES },
  { pattern: /^\/admin\/requests\/[^/]+\/review$/, roles: REQUEST_WRITE_ROLES },
  { pattern: /^\/admin\/contracts\/new$/, roles: SUPPLY_ROLES },
  { pattern: /^\/admin\/contracts\/[^/]+\/configure$/, roles: SUPPLY_ROLES },
  { pattern: /^\/admin\/parties\/new$/, roles: SUPPLY_ROLES },
  { pattern: /^\/admin\/assets\/new$/, roles: TECHNICAL_ROLES },
  { pattern: /^\/admin\/pricing\/new$/, roles: SUPPLY_ROLES },
  { pattern: /^\/admin\/metering\/new$/, roles: TECHNICAL_ROLES },
  { pattern: /^\/admin\/settlements\/new$/, roles: ["ADMIN"] },
];

export function canAccessAdminPath(role: AppRole, pathname: string): boolean {
  if (pathname === "/admin") return roleIsAllowed(role, INTERNAL_ROLES);
  const nestedRule = ADMIN_NESTED_ROUTE_RULES.find(({ pattern }) => pattern.test(pathname));
  if (nestedRule) return roleIsAllowed(role, nestedRule.roles);
  const rule = ADMIN_ROUTE_RULES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return rule ? roleIsAllowed(role, rule.roles) : false;
}

export function canCreateCustomerRequest(role: AppRole, accessiblePartyCount: number): boolean {
  return role === "CUSTOMER" || (role === "CUSTOMER_REPRESENTATIVE" && accessiblePartyCount === 1);
}
