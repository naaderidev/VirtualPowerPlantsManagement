"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Label } from "@/components/ui/label";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectWithLabels,
} from "@/components/ui/select";
import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { eligibleSettlementMonths, firstCoveredSettlementMonth } from "@/domain/settlement/eligible-months";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatPersianMonth } from "@/lib/persian-date";

type ContractAsset = {
  assetId: string;
  asset: { id: string; name: string; capacityNominal: number };
};

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  parties: Array<{ role: string; party: { displayName: string } }>;
  assets: ContractAsset[];
};

type ContractDetail = Contract & {
  effectiveDate: string;
  expirationDate: string | null;
  terminationDate: string | null;
  schedules: Array<{
    assetId: string;
    active: boolean;
    startDate: string;
    endDate: string;
    settlementCycle: string;
    pricingPlan: { status: string; validFrom: string; validTo: string | null };
  }>;
};

type SettlementResult = {
  settlement: { id: string; settlementNumber: string };
  calculation: {
    readingsCount: number;
    totalEnergyAccepted: number;
    unitPrice: number;
    netAmount: number;
    pricingPlanName: string;
  };
  idempotentReplay: boolean;
};

function sellerName(contract: Contract): string {
  return (
    contract.parties.find(({ role }) => role === "SELLER")?.party.displayName ??
    "فروشنده نامشخص"
  );
}

export default function NewSettlementPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [error, setError] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [month, setMonth] = useState("");
  const [eligibleMonths, setEligibleMonths] = useState<string[]>([]);
  const [nextCoveredMonth, setNextCoveredMonth] = useState<string | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/contracts?limit=100")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            getApiErrorMessage(body, "دریافت قراردادها ناموفق بود."),
          );
        return body as Contract[];
      })
      .then((items) => {
        if (active)
          setContracts(
            items.filter(
              ({ status, assets }) => ["ACTIVE", "TERMINATION_PENDING", "TERMINATED"].includes(status) && assets.length > 0,
            ),
          );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedContract = useMemo(
    () => contracts.find(({ id }) => id === selectedContractId) ?? null,
    [contracts, selectedContractId],
  );

  useEffect(() => {
    if (!selectedContractId || !selectedAssetId) return;
    const controller = new AbortController();
    async function loadEligibleMonths() {
      setPeriodLoading(true);
      try {
        const response = await fetch(`/api/contracts?id=${encodeURIComponent(selectedContractId)}`, { signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getApiErrorMessage(body, "دریافت بازهٔ مجاز تسویه ناموفق بود."));
        const detail = body as ContractDetail;
        const schedule = detail.schedules.find(({ assetId, active, settlementCycle }) =>
          assetId === selectedAssetId && active && settlementCycle === "MONTHLY"
        );
        const contractEnd = [detail.expirationDate, detail.terminationDate]
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;
        const window = schedule ? {
          contractStart: detail.effectiveDate,
          contractEnd,
          scheduleStart: schedule.startDate,
          scheduleEnd: schedule.endDate,
          pricingStart: schedule.pricingPlan.validFrom,
          pricingEnd: schedule.pricingPlan.validTo,
          pricingActive: schedule.pricingPlan.status === "ACTIVE",
          now: new Date(),
        } : null;
        const available = window ? eligibleSettlementMonths(window) : [];
        if (!controller.signal.aborted) {
          setEligibleMonths(available);
          setNextCoveredMonth(window ? firstCoveredSettlementMonth(window) : null);
          setMonth(available.at(-1) ?? "");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "دریافت بازهٔ مجاز تسویه ناموفق بود.");
      } finally {
        if (!controller.signal.aborted) setPeriodLoading(false);
      }
    }
    void loadEligibleMonths();
    return () => controller.abort();
  }, [selectedContractId, selectedAssetId]);

  function selectContract(contractId: string) {
    setSelectedContractId(contractId);
    setSelectedAssetId("");
    setMonth("");
    setEligibleMonths([]);
    setNextCoveredMonth(null);
    setResult(null);
    setError("");
  }

  async function calculateSettlement(event: React.FormEvent) {
    event.preventDefault();
    const period = calendarMonthPeriod(month);
    if (!selectedContract || !selectedAssetId || !period || !eligibleMonths.includes(month)) {
      setError("قرارداد، نیروگاه و ماه تسویه را کامل انتخاب کنید.");
      return;
    }

    setCalculating(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/settlements/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContract.id,
          assetId: selectedAssetId,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(getApiErrorMessage(body, "محاسبه تسویه ناموفق بود."));
      setResult(body as SettlementResult);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "خطای غیرمنتظره در محاسبه تسویه",
      );
    } finally {
      setCalculating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/settlements" aria-label="بازگشت به تسویه‌ها">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">محاسبه تسویه ماهانه</h1>
          <p className="text-muted-foreground">
            هر نیروگاه قرارداد مادر به‌صورت مستقل محاسبه و بررسی می‌شود.
          </p>
        </div>
      </div>

      {contracts.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            قرارداد دارای نیروگاه و دورهٔ قابل تسویه وجود ندارد.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            پارامترهای تسویه مستقل
          </CardTitle>
          <CardDescription>
            ماه به بازه روز اول این ماه تا روز اول ماه بعد تبدیل می‌شود. کل بازه
            باید قرائت پذیرفته‌شده و بدون شکاف داشته باشد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={calculateSettlement} className="space-y-5">
            {error && (
              <div
                className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>قرارداد قابل تسویه *</Label>
                <SelectWithLabels
                  value={selectedContractId}
                  onValueChange={(value) => selectContract(value ?? "")}
                >
                  <SelectTrigger aria-label="انتخاب قرارداد فعال" className='w-full'>
                    <SelectValue placeholder="انتخاب قرارداد" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contractNumber} — {sellerName(contract)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settlementMonth">ماه تسویه *</Label>
                <PersianDatePicker
                  id="settlementMonth"
                  value={month}
                  onChange={(value) => {
                    if (eligibleMonths.includes(value)) setMonth(value);
                    setResult(null);
                  }}
                  monthOnly
                  minDate={eligibleMonths[0] ? `${eligibleMonths[0].replace("-", "/")}/01` : undefined}
                  maxDate={eligibleMonths.at(-1) ? `${eligibleMonths.at(-1)!.replace("-", "/")}/01` : undefined}
                  disabled={periodLoading || eligibleMonths.length === 0}
                  placeholder={periodLoading ? "در حال بررسی قرارداد…" : "انتخاب ماه شمسی"}
                  required
                />
                {selectedAssetId && !periodLoading && (
                  <p className="text-xs text-muted-foreground">
                    {eligibleMonths.length > 0
                      ? `ماه پیشنهادی ${formatPersianMonth(eligibleMonths.at(-1))} است. فقط ماه‌های کامل و پایان‌یافته در اعتبار قرارداد، برنامهٔ تجاری و نرخ‌نامه قابل انتخاب‌اند؛ قرائت‌های پذیرفته‌شده نیز برای محاسبه لازم‌اند.`
                      : `هنوز ماه کاملِ پایان‌یافته‌ای در اعتبار قرارداد، برنامهٔ تجاری و نرخ‌نامه وجود ندارد؛ انتخاب ماه و محاسبه تسویه غیرفعال است.${nextCoveredMonth ? ` نخستین ماه قابل‌بررسی پس از پایان دوره: ${formatPersianMonth(nextCoveredMonth)}.` : ""}`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>نیروگاه همین قرارداد *</Label>
              <SelectWithLabels
                value={selectedAssetId}
                onValueChange={(value) => {
                  setSelectedAssetId(value ?? "");
                  setMonth("");
                  setEligibleMonths([]);
                  setNextCoveredMonth(null);
                  setResult(null);
                }}
                disabled={!selectedContract}
              >
                <SelectTrigger aria-label="انتخاب نیروگاه قرارداد" className='w-full'>
                  <SelectValue
                    placeholder={
                      selectedContract
                        ? "انتخاب یکی از نیروگاه‌های قرارداد"
                        : "ابتدا قرارداد را انتخاب کنید"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {selectedContract?.assets.map(({ assetId, asset }) => (
                    <SelectItem key={assetId} value={assetId}>
                      {asset.name} ({asset.capacityNominal.toLocaleString()}{" "}
                      کیلووات)
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
              {selectedContract && selectedContract.assets.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  پس از ثبت این تسویه، همین ماه را برای نیروگاه دوم جداگانه
                  محاسبه کنید.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={
                  calculating || periodLoading || !selectedContract || !selectedAssetId || !eligibleMonths.includes(month)
                }
              >
                {calculating ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="ml-2 h-4 w-4" />
                )}
                محاسبه تسویه این نیروگاه
              </Button>
              <Link
                href="/admin/settlements"
                className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
              >
                انصراف
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              {result.idempotentReplay
                ? "تسویه قبلی بازیابی شد"
                : "تسویه مستقل ایجاد شد"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                شماره:{" "}
                <span className="font-mono font-medium">
                  {result.settlement.settlementNumber}
                </span>
              </p>
              <p>
                نرخ‌نامه:{" "}
                <span className="font-medium">
                  {result.calculation.pricingPlanName}
                </span>
              </p>
              <p>
                تعداد قرائت‌ها:{" "}
                <span className="font-medium">
                  {result.calculation.readingsCount}
                </span>
              </p>
              <p>
                انرژی پذیرفته‌شده:{" "}
                <span className="font-medium">
                  {result.calculation.totalEnergyAccepted.toLocaleString()} kWh
                </span>
              </p>
              <p>
                قیمت واحد:{" "}
                <span className="font-medium">
                  {result.calculation.unitPrice.toLocaleString()} ریال
                </span>
              </p>
              <p>
                مبلغ نهایی:{" "}
                <span className="font-bold text-green-800">
                  {result.calculation.netAmount.toLocaleString()} ریال
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/admin/settlements/${result.settlement.id}`)
                }
              >
                مشاهده جزئیات
              </Button>
              {selectedContract && selectedContract.assets.length > 1 && (
                <Button
                  onClick={() => {
                    setSelectedAssetId("");
                    setResult(null);
                  }}
                >
                  محاسبه نیروگاه دیگر
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
