import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Home, 
  FileText, 
  Building2, 
  FileSignature, 
  Receipt, 
  CreditCard, 
  Bell,
  Shield,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { CUSTOMER_ROLES } from "@/lib/access-control";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNavigation } from "@/components/shared/mobile-navigation";
import { ActingPartySwitcher } from "@/components/customer/acting-party-switcher";

const navItems = [
  { href: "/customer/dashboard", label: "داشبورد", icon: Home },
  { href: "/customer/requests", label: "درخواست‌ها", icon: FileText, partyScoped: true },
  { href: "/customer/assets", label: "نیروگاه‌های من", icon: Building2, partyScoped: true },
  { href: "/customer/contracts", label: "قراردادها", icon: FileSignature, partyScoped: true },
  { href: "/customer/settlements", label: "تسویه‌ها", icon: Receipt, partyScoped: true },
  { href: "/customer/netting", label: "خالص‌سازی", icon: Shield, partyScoped: true },
  { href: "/customer/invoices", label: "اسناد مالی", icon: CreditCard, partyScoped: true },
  { href: "/customer/notifications", label: "اعلان‌ها", icon: Bell, partyScoped: true },
];

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) redirect("/login");
  if (!CUSTOMER_ROLES.includes(user.role as (typeof CUSTOMER_ROLES)[number])) {
    redirect("/admin/dashboard");
  }
  if (user.role === "CUSTOMER" && !user.partyId) {
    redirect("/onboarding/customer");
  }

  const actingParty = user.actingPartyOptions.find(
    ({ id }) => id === user.actingPartyId
  ) ?? null;
  const requiresActingPartySelection =
    user.role === "CUSTOMER_REPRESENTATIVE" && !actingParty;
  const canShowPartyNavigation =
    !requiresActingPartySelection && user.accessiblePartyIds.length > 0;
  const navigation = (
    <nav className="space-y-1" aria-label="بخش‌های پنل فروشنده">
      {navItems.filter((item) => !item.partyScoped || canShowPartyNavigation).map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span>{item.label}</span>
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
            <MobileNavigation title="منوی پنل فروشنده" className="md:hidden">
              {navigation}
            </MobileNavigation>
            {user.role === "CUSTOMER_REPRESENTATIVE" && (
              <ActingPartySwitcher
                parties={user.actingPartyOptions}
                actingPartyId={user.actingPartyId}
              />
            )}
            <LogoutButton clearActingParty={user.role === "CUSTOMER_REPRESENTATIVE"} />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <Link href="/customer" aria-label="پنل فروشنده" className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <span className="hidden whitespace-nowrap text-sm font-bold sm:inline sm:text-lg">پنل فروشنده</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user.actingPartyId && (
              <Link
                href="/customer/notifications"
                aria-label="مشاهده اعلان‌ها"
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <Bell className="h-5 w-5" />
              </Link>
            )}
            <div className="hidden text-sm lg:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs">
                {user.role === "CUSTOMER_REPRESENTATIVE" ? "نماینده فروشنده" : "فروشنده برق"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar Navigation */}
        <aside className="hidden w-64 border-l bg-gray-50 p-4 md:block">
          {navigation}
        </aside>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {requiresActingPartySelection ? (
            <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center">
              <div className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 p-8 text-center shadow-sm">
                <Shield className="mx-auto mb-4 h-10 w-10 text-cyan-800" />
                <h1 className="text-xl font-bold text-slate-950">انتخاب طرف فعالیت الزامی است</h1>
                <p className="mt-3 leading-7 text-slate-600">
                  پیش از مشاهده درخواست‌ها، قراردادها و اسناد، حساب شخصی یا یکی از شرکت‌های تحت نمایندگی را از پنجره بازشده انتخاب کنید.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {user.role === "CUSTOMER_REPRESENTATIVE" && actingParty && (
                <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    {actingParty.kind === "PERSONAL" ? (
                      <UserRound className="h-5 w-5 text-teal-700" />
                    ) : (
                      <Building2 className="h-5 w-5 text-teal-700" />
                    )}
                    طرف فعالیت فعلی: <strong>{actingParty.displayName}</strong>
                  </span>
                  <span className="text-xs text-teal-800">
                    {actingParty.kind === "PERSONAL" ? "حساب شخصی" : "شرکت تحت نمایندگی"}
                  </span>
                </div>
              )}
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
