import { UserRole } from "@prisma/client";

export function getSeededUsers(adminMobile: string) {
  if (!/^09\d{9}$/.test(adminMobile)) {
    throw new Error("ADMIN_SEED_MOBILE must be an 11-digit Iranian mobile number");
  }

  const users = [
    { name: "مدیر اصلی سامانه", mobile: adminMobile, email: "admin@vpp.local", role: UserRole.ADMIN },
    { name: "کارشناس تأمین", mobile: "09191111111", email: "supply@vpp.local", role: UserRole.STAFF_SUPPLY },
    { name: "کارشناس فنی", mobile: "09192222222", email: "technical@vpp.local", role: UserRole.STAFF_TECHNICAL },
    { name: "کارشناس حقوقی", mobile: "09193333333", email: "legal@vpp.local", role: UserRole.STAFF_LEGAL },
    { name: "کارشناس مالی", mobile: "09194444444", email: "finance@vpp.local", role: UserRole.STAFF_FINANCIAL },
    { name: "مدیر", mobile: "09195555555", email: "manager@vpp.local", role: UserRole.MANAGER },
    { name: "فروشنده آزمایشی", mobile: "09191234567", email: "customer@vpp.local", role: UserRole.CUSTOMER },
    { name: "نماینده مشتری", mobile: "09196666666", email: "representative@vpp.local", role: UserRole.CUSTOMER_REPRESENTATIVE },
  ] as const;
  if (new Set(users.map(({ mobile }) => mobile)).size !== users.length) {
    throw new Error("ADMIN_SEED_MOBILE must differ from other seeded user mobiles");
  }
  return users;
}
