"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Label } from "@/components/ui/label";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Loader2 } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { toPersianMonthKey } from "@/lib/persian-date";

interface PricingPlan {
  id: string;
  name: string;
  model: string;
  fixedRate: number | null;
}

interface PricingResult {
  unitPrice: number;
  baseAmount: number;
  totalAmount: number;
  formula: string;
  breakdown: {
    fixedComponent?: number;
    marketComponent?: number;
    rawPrice?: number;
  };
  currency: string;
  energyUnit: string;
}

export default function PricingEnginePage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);

  const [energy, setEnergy] = useState("");
  const [period, setPeriod] = useState(() => toPersianMonthKey(new Date()));
  const [selectedPlanId, setSelectedPlanId] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/pricing-rules")
      .then(async (response) => response.ok ? response.json() : [])
      .then((data) => {
        if (active) setPlans(data.plans || data || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCalculate = async () => {
    if (!energy || !selectedPlanId) return;
    setCalculating(true);
    setResult(null);

    try {
      const res = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          energy: parseFloat(energy),
          period,
          pricingPlanId: selectedPlanId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err, "خطا در محاسبه"));
      }

      setResult(await res.json());
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "خطای ناشناخته در محاسبه قیمت");
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">موتور قیمت‌گذاری</h1>
        <p className="text-muted-foreground">محاسبه قیمت بر اساس انرژی و نرخ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            محاسبه قیمت
          </CardTitle>
          <CardDescription>پارامترهای محاسبه را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="energy">انرژی (kWh) *</Label>
              <Input
                id="energy"
                type="number"
                value={energy}
                onChange={(e) => setEnergy(e.target.value)}
                placeholder="مثال: 10000"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">دوره صورتحساب *</Label>
              <PersianDatePicker
                id="period"
                value={period}
                onChange={setPeriod}
                monthOnly
                placeholder="انتخاب ماه شمسی"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">نرخ‌نامه قیمت *</Label>
              <SelectWithLabels value={selectedPlanId} onValueChange={(v) => setSelectedPlanId(v || "")}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="انتخاب نرخ‌نامه" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              شاخص بازار از مشاهده ثبت‌شده و قابل ردیابی همان دوره خوانده می‌شود و ورود دستی در محاسبه مجاز نیست.
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={calculating || !energy || !selectedPlanId}>
            {calculating ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 ml-2" />
            )}
            محاسبه قیمت
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600">نتیجه محاسبه</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">قیمت واحد</p>
                <p className="text-2xl font-bold text-primary">
                  {result.unitPrice.toLocaleString()} ریال
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">مبلغ کل</p>
                <p className="text-2xl font-bold text-primary">
                  {result.totalAmount.toLocaleString()} ریال
                </p>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">فرمول:</p>
              <p className="font-mono text-sm">{result.formula}</p>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>ارز: {result.currency} | واحد انرژی: {result.energyUnit}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
