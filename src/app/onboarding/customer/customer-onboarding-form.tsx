"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  defaultName: string;
  defaultMobile: string;
  defaultEmail: string;
};
type FieldErrors = Record<string, string[]>;

export function CustomerOnboardingForm({
  defaultName,
  defaultMobile,
  defaultEmail,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [type, setType] = useState<"PERSON" | "COMPANY">("PERSON");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    try {
      const response = await fetch("/api/customer/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          displayName: value("displayName"),
          nationalId: value("nationalId") || null,
          economicCode: value("economicCode") || null,
          registrationNo: value("registrationNo") || null,
          taxId: value("taxId") || null,
          phone: value("phone") || null,
          email: value("email") || null,
          address: value("address") || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "ثبت اطلاعات ناموفق بود.");
        setFieldErrors(body.error?.details ?? {});
        return;
      }
      router.replace("/customer/dashboard");
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (name: string) => fieldErrors[name]?.[0];
  return (
    <main className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <CardTitle>تکمیل پروفایل فروشنده</CardTitle>
          </div>
          <CardDescription>
            برای ثبت درخواست خرید برق، اطلاعات طرف تجاری مطابق سند پروژه الزامی
            است.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>نوع فروشنده</Label>
              <SelectWithLabels
                value={type}
                onValueChange={(value) =>
                  setType(value as "PERSON" | "COMPANY")
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSON">شخص حقیقی</SelectItem>
                  <SelectItem value="COMPANY">شخص حقوقی</SelectItem>
                </SelectContent>
              </SelectWithLabels>
            </div>
            <Field
              name="displayName"
              label="نام و نام خانوادگی / نام شرکت"
              defaultValue={defaultName}
              error={fieldError("displayName")}
              required
            />
            <Field
              name="nationalId"
              label="کد ملی / شناسه ملی"
              error={fieldError("nationalId")}
            />
            {type === "COMPANY" && (
              <>
                <Field
                  name="economicCode"
                  label="کد اقتصادی"
                  error={fieldError("economicCode")}
                />
                <Field
                  name="registrationNo"
                  label="شماره ثبت"
                  error={fieldError("registrationNo")}
                />
                <Field
                  name="taxId"
                  label="شناسه مالیاتی"
                  error={fieldError("taxId")}
                />
              </>
            )}
            <Field
              name="phone"
              label="شماره تماس"
              defaultValue={defaultMobile}
              error={fieldError("phone")}
              dir="ltr"
            />
            <Field
              name="email"
              label="ایمیل"
              defaultValue={defaultEmail}
              error={fieldError("email")}
              dir="ltr"
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">نشانی</Label>
              <Input id="address" name="address" />
              <p className="text-xs text-destructive">
                {fieldError("address")}
              </p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                ثبت و ورود به پنل
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: { name: string; label: string; error?: string } & React.ComponentProps<
  typeof Input
>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...inputProps} />
      <p className="text-xs text-destructive">{error}</p>
    </div>
  );
}
