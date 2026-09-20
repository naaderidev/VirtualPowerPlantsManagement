export const DEMO_ACCOUNTS = [
  { role: "ADMIN", name: "مدیر اصلی سامانه", title: "مدیر سامانه", mobile: null, description: "دسترسی کامل به تنظیمات، کاربران و تمام فرایندهای سامانه" },
  { role: "STAFF_SUPPLY", name: "کارشناس تأمین", title: "کارشناس تأمین", mobile: "09191111111", description: "بررسی درخواست‌ها، پیشنهاد قیمت و آماده‌سازی قرارداد" },
  { role: "STAFF_TECHNICAL", name: "کارشناس فنی", title: "کارشناس فنی", mobile: "09192222222", description: "ارزیابی فنی نیروگاه، مدارک، کنتور و داده‌های تولید" },
  { role: "STAFF_LEGAL", name: "کارشناس حقوقی", title: "کارشناس حقوقی", mobile: "09193333333", description: "بازبینی مفاد، مستندات و تأیید حقوقی قراردادها" },
  { role: "STAFF_FINANCIAL", name: "کارشناس مالی", title: "کارشناس مالی", mobile: "09194444444", description: "بررسی تسویه‌ها، صورتحساب‌ها و تخصیص پرداخت‌ها" },
  { role: "MANAGER", name: "مدیر", title: "مدیر کسب‌وکار", mobile: "09195555555", description: "نظارت مدیریتی بر عملیات، گزارش‌ها و شاخص‌های کلیدی" },
  { role: "CUSTOMER", name: "فروشنده آزمایشی", title: "فروشنده برق", mobile: "09191234567", description: "ثبت درخواست فروش برق و پیگیری قرارداد، تسویه و پرداخت" },
  { role: "CUSTOMER_REPRESENTATIVE", name: "نماینده مشتری", title: "نماینده فروشنده", mobile: "09196666666", description: "پیگیری فرایندهای فروشنده در محدوده نمایندگی ثبت‌شده" },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

export function getPostLoginPath(role: string): "/admin/dashboard" | "/customer/dashboard" {
  return role === "ADMIN" || role === "MANAGER" || role.startsWith("STAFF_")
    ? "/admin/dashboard"
    : "/customer/dashboard";
}

export function isDemoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_LOGIN === "true";
}
