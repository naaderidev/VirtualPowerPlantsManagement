"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutGrid, Zap, Loader2 } from "lucide-react";
import { getPostLoginPath } from "@/lib/demo-accounts";

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        mobile,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("شماره موبایل یا رمز عبور اشتباه است");
      } else {
        // Redirect based on role
        const session = await fetch("/api/auth/session").then((res) => res.json());
        const role = session?.user?.role;
        
        router.push(getPostLoginPath(role));
        router.refresh();
      }
    } catch {
      setError("خطا در اتصال به سرور");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">ورود به سامانه</CardTitle>
          <CardDescription>سامانه مدیریت انرژی برقتو</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mobile">شماره موبایل</Label>
              <Input
                id="mobile"
                type="text"
                placeholder="09191234567"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال ورود...
                </>
              ) : (
                "ورود"
              )}
            </Button>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <Link
              href="/cards"
              className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              <LayoutGrid className="h-5 w-5 text-teal-700" />
              ورود سریع با انتخاب نقش
            </Link>
          )}
          
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">کاربران محیط توسعه:</p>
              <p className="text-xs text-muted-foreground">ادمین: شماره تنظیم‌شده در ADMIN_SEED_MOBILE</p>
              <p className="text-xs text-muted-foreground">مشتری: 09191234567</p>
              <p className="mt-1 text-xs text-muted-foreground">رمزها هنگام seed از متغیرهای محیطی خوانده می‌شوند.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
