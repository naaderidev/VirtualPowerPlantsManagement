"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  BarChart3,
  Factory,
  Handshake,
  Key,
  Loader2,
  Scale,
  ShieldCheck,
  UserRoundCog,
  WalletCards,
  Wrench,
  Zap,
  type LucideProps,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS, getPostLoginPath, type DemoAccount } from "@/lib/demo-accounts";

type RoleVisual = {
  icon: ComponentType<LucideProps>;
  iconClassName: string;
  iconBackgroundClassName: string;
};

const roleVisuals: Record<DemoAccount["role"], RoleVisual> = {
  ADMIN: { icon: ShieldCheck, iconClassName: "text-white", iconBackgroundClassName: "bg-violet-800" },
  STAFF_SUPPLY: { icon: Handshake, iconClassName: "text-white", iconBackgroundClassName: "bg-sky-800" },
  STAFF_TECHNICAL: { icon: Wrench, iconClassName: "text-white", iconBackgroundClassName: "bg-amber-700" },
  STAFF_LEGAL: { icon: Scale, iconClassName: "text-white", iconBackgroundClassName: "bg-rose-800" },
  STAFF_FINANCIAL: { icon: WalletCards, iconClassName: "text-white", iconBackgroundClassName: "bg-emerald-800" },
  MANAGER: { icon: BarChart3, iconClassName: "text-white", iconBackgroundClassName: "bg-indigo-700" },
  CUSTOMER: { icon: Factory, iconClassName: "text-white", iconBackgroundClassName: "bg-teal-700" },
  CUSTOMER_REPRESENTATIVE: { icon: UserRoundCog, iconClassName: "text-white", iconBackgroundClassName: "bg-cyan-700" },
};

export function DemoRoleCards() {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<DemoAccount["role"] | null>(null);
  const [error, setError] = useState("");

  const loginAs = async (account: DemoAccount) => {
    setPendingRole(account.role);
    setError("");

    try {
      const result = await signIn("demo", {
        role: account.role,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        setError("ورود آزمایشی انجام نشد. از اجرای seed کاربران مطمئن شوید.");
        return;
      }

      router.replace(getPostLoginPath(account.role));
      router.refresh();
    } catch {
      setError("ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 shadow-lg shadow-teal-700/20">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <p className="mb-3 text-sm font-semibold text-teal-700">ورود سریع نسخه نمایشی</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">سامانه مدیریت انرژی برقتو</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            برای مشاهده فرایندها از دید هر کاربر، نقش موردنظر را انتخاب کنید. نیازی به واردکردن شماره موبایل و رمز عبور نیست.
          </p>
        </header>

        {error && <div role="alert" className="mx-auto mb-6 max-w-2xl rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</div>}

        <section aria-label="نقش‌های قابل ورود" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_ACCOUNTS.map((account) => {
            const visual = roleVisuals[account.role];
            const Icon = visual.icon;
            const isPending = pendingRole === account.role;
            const isAnotherPending = pendingRole !== null && !isPending;

            return (
              <Card key={account.role} className="group h-full border-slate-200 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-200/70">
                <CardHeader className="pb-3 flex flex-col items-center justify-center">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${visual.iconBackgroundClassName}`}>
                    <Icon className={`h-6 w-6 ${visual.iconClassName}`} />
                  </div>
                  <CardTitle className="text-lg">{account.title}</CardTitle>
                  <CardDescription className="text-xs">{account.name}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-[calc(100%-7rem)] flex-col justify-between gap-1">
                  <p className="min-h-14 text-sm leading-6 text-slate-600 text-center">{account.description}</p>
                  <Button className="w-full justify-between" onClick={() => loginAs(account)} disabled={pendingRole !== null}>
                    <span>{isPending ? "در حال ورود..." : "ورود با این نقش"}</span>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />}
                    {isAnotherPending && <span className="sr-only">ورود نقش دیگری در حال انجام است</span>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <footer className="mt-10 text-center">
          <Link href="/login" className="text-sm text-slate-600 underline-offset-4 hover:text-teal-700 hover:underline flex items-center justify-center gap-2"><Key className="h-5 w-5 text-teal-700" />ورود با شماره موبایل و رمز عبور</Link>
        </footer>
      </div>
    </main>
  );
}
