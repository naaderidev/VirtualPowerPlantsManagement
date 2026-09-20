import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Home, 
  FileText, 
  Users, 
  Building2, 
  FileSignature, 
  DollarSign, 
  BarChart3,
  Bell,
  Settings,
  Zap as EnergyIcon,
  Calculator,
  LineChart,
  Receipt,
  CreditCard,
  Shield,
  ClipboardList,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { INTERNAL_ROLES, roleIsAllowed } from "@/lib/access-control";
import { ADMIN_NAVIGATION_ROLES, type AdminNavigationKey } from "@/lib/ui-access";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNavigation } from "@/components/shared/mobile-navigation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  accessKey: AdminNavigationKey;
}

interface SeparatorItem {
  separator: true;
}

const navItems: (NavItem | SeparatorItem)[] = [
  { href: "/admin/dashboard", label: "داشبورد", icon: Home, accessKey: "dashboard" },
  { href: "/admin/requests", label: "درخواست‌ها", icon: FileText, accessKey: "requests" },
  { href: "/admin/parties", label: "طرف‌ها", icon: Users, accessKey: "parties" },
  { href: "/admin/representatives", label: "نمایندگان", icon: UserCog, accessKey: "representatives" },
  { href: "/admin/assets", label: "دارایی‌ها", icon: Building2, accessKey: "assets" },
  { separator: true },
  { href: "/admin/contracts", label: "قراردادها", icon: FileSignature, accessKey: "contracts" },
  { href: "/admin/proposals", label: "پیشنهادها", icon: ClipboardList, accessKey: "proposals" },
  { href: "/admin/pricing", label: "نرخ‌نامه‌ها", icon: DollarSign, accessKey: "pricing" },
  { href: "/admin/market-indices", label: "شاخص‌های بازار", icon: LineChart, accessKey: "market-indices" },
  { href: "/admin/pricing-engine", label: "موتور قیمت", icon: Calculator, accessKey: "pricing-engine" },
  { separator: true },
  { href: "/admin/metering", label: "اندازه‌گیری", icon: EnergyIcon, accessKey: "metering" },
  { href: "/admin/meters/new", label: "ثبت کنتور", icon: EnergyIcon, accessKey: "meters-new" },
  { href: "/admin/settlements", label: "تسویه‌ها", icon: Calculator, accessKey: "settlements" },
  { href: "/admin/financial-configurations", label: "تنظیمات مالی", icon: Settings, accessKey: "financial-configurations" },
  { href: "/admin/invoices", label: "صورتحساب", icon: Receipt, accessKey: "invoices" },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: CreditCard, accessKey: "payments" },
  { href: "/admin/netting", label: "خالص‌سازی", icon: Shield, accessKey: "netting" },
  { separator: true },
  { href: "/admin/reports", label: "گزارش‌ها", icon: BarChart3, accessKey: "reports" },
  { href: "/admin/notifications", label: "اعلان‌ها", icon: Bell, accessKey: "notifications" },
  { href: "/admin/audit-log", label: "سابقه فعالیت", icon: ClipboardList, accessKey: "audit-log" },
  { href: "/admin/users", label: "کاربران", icon: Users, accessKey: "users" },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings, accessKey: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) redirect("/login");
  if (!INTERNAL_ROLES.includes(user.role as (typeof INTERNAL_ROLES)[number])) {
    redirect("/customer/dashboard");
  }

  const permittedItems = navItems.filter(
    (item) => "separator" in item || roleIsAllowed(user.role, ADMIN_NAVIGATION_ROLES[item.accessKey])
  );
  const visibleNavItems = permittedItems.filter((item, index) => {
    if (!("separator" in item)) return true;
    return index > 0 && index < permittedItems.length - 1 && !("separator" in permittedItems[index - 1]);
  });
  const navigation = (
    <nav className="space-y-1" aria-label="بخش‌های پنل عملیات">
      {visibleNavItems.map((item, index) => {
        if ("separator" in item && item.separator) {
          return <Separator key={`sep-${index}`} className="my-2" />;
        }
        const navItem = item as NavItem;
        const Icon = navItem.icon;
        return (
          <Link
            key={navItem.href}
            href={navItem.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span>{navItem.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <MobileNavigation title="منوی پنل عملیات" className="lg:hidden">
              {navigation}
            </MobileNavigation>
            <LogoutButton />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <Link href="/admin" className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <span className="whitespace-nowrap text-sm font-bold sm:text-lg">پنل عملیات</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/admin/notifications"
              aria-label="مشاهده اعلان‌ها"
              className={buttonVariants({ variant: "ghost", size: "icon" })}
            >
              <Bell className="h-5 w-5" />
            </Link>
            <div className="hidden text-sm sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs">{user.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <aside className="hidden w-64 overflow-y-auto border-l bg-gray-50 p-4 lg:block">
          {navigation}
        </aside>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
