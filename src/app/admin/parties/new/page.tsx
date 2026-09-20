"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, User, Building2 } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";

export default function NewPartyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    type: "PERSON",
    displayName: "",
    economicCode: "",
    nationalId: "",
    registrationNo: "",
    taxId: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(getApiErrorMessage(data, "خطا در ایجاد طرف"));
      }

      const party = await response.json();
      router.push(`/admin/parties/${party.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/parties" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">ایجاد طرف جدید</h1>
          <p className="text-muted-foreground">طرف قرارداد جدید را ثبت کنید</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {formData.type === "PERSON" ? (
              <User className="h-5 w-5" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
            اطلاعات طرف
          </CardTitle>
          <CardDescription>مشخصات کلی طرف قرارداد را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">نوع طرف *</Label>
                <SelectWithLabels
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value || "PERSON" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSON">شخص حقیقی</SelectItem>
                    <SelectItem value="COMPANY">شخص حقوقی</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">نام کامل *</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder={formData.type === "PERSON" ? "مثال: علی رضایی" : "مثال: شرکت انرژی سبز"}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nationalId">
                  {formData.type === "PERSON" ? "کد ملی" : "شناسه ملی"}
                </Label>
                <Input
                  id="nationalId"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  placeholder={formData.type === "PERSON" ? "کد ملی ۱۰ رقمی" : "شناسه ملی"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">تلفن *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="09121234567"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {formData.type === "COMPANY" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="economicCode">کد اقتصادی</Label>
                  <Input
                    id="economicCode"
                    value={formData.economicCode}
                    onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
                    placeholder="کد اقتصادی"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNo">شماره ثبت</Label>
                  <Input
                    id="registrationNo"
                    value={formData.registrationNo}
                    onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                    placeholder="شماره ثبت شرکت"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">شماره مالیاتی</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="شماره مالیاتی"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {formData.type === "PERSON" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>

                <div></div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="address">آدرس</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="آدرس دقیق"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <User className="h-4 w-4 ml-2" />
                )}
                ایجاد طرف
              </Button>
              <Link href="/admin/parties">
                <Button type="button" variant="outline">
                  انصراف
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
