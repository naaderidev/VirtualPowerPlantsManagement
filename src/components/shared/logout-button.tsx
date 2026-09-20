"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ clearActingParty = false }: { clearActingParty?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const logout = async () => {
    setLoading(true);
    setError("");
    if (clearActingParty) {
      try {
        const response = await fetch("/api/customer/acting-party", { method: "DELETE" });
        if (!response.ok) console.error("پاک‌کردن طرف فعالیت پیش از خروج ناموفق بود.");
      } catch {
        console.error("پاک‌کردن طرف فعالیت پیش از خروج ناموفق بود.");
      }
    }
    try {
      await signOut({ redirect: false });
      window.location.replace("/cards");
    } catch {
      setError("خروج انجام نشد؛ دوباره تلاش کنید.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" className="gap-2" aria-label="خروج از حساب و بازگشت به کارت‌ها" title="خروج از حساب و بازگشت به کارت‌ها" onClick={logout} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        <span className="hidden sm:inline">خروج و بازگشت به کارت‌ها</span>
      </Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
