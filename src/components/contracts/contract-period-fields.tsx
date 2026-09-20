"use client";

import { CalendarCheck2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  fullSettlementMonths,
  alignContractPeriodToFullMonths,
  getContractPeriodIssue,
  type ContractPeriod,
} from "@/domain/contracts/contract-period";
import { formatPersianDate } from "@/lib/persian-date";

type ContractPeriodFieldsProps = {
  period: ContractPeriod;
  suggestedPeriod: ContractPeriod;
  suggestionReason: string;
  onChange: (period: ContractPeriod) => void;
};

export function ContractPeriodFields({
  period,
  suggestedPeriod,
  suggestionReason,
  onChange,
}: Readonly<ContractPeriodFieldsProps>) {
  const issue = getContractPeriodIssue(period);
  const fullMonthCount = issue ? null : fullSettlementMonths(period).length;
  const alignedPeriod = issue ? null : alignContractPeriodToFullMonths(period);

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-2">
            <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                بازه پیشنهادی: {formatPersianDate(suggestedPeriod.effectiveDate)} تا {formatPersianDate(suggestedPeriod.expirationDate)}
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">{suggestionReason}</p>
            </div>
          </div>
          {(period.effectiveDate !== suggestedPeriod.effectiveDate || period.expirationDate !== suggestedPeriod.expirationDate) && (
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(suggestedPeriod)}>
              <RotateCcw className="ml-2 h-3.5 w-3.5" />
              اعمال بازه پیشنهادی
            </Button>
          )}
        </div>
      </div>

      {fullMonthCount !== null && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6">
          این بازه {fullMonthCount.toLocaleString("fa-IR")} ماه کاملِ قابل‌بررسی برای تسویه دارد.
          بخش‌های ناقص ابتدا و انتهای قرارداد فعلاً در تسویه ماهانه محاسبه نمی‌شوند.
          هر ماه فقط پس از پایان دوره و تأیید قرائت‌های آن قابل تسویه است.
          {alignedPeriod && (alignedPeriod.effectiveDate !== period.effectiveDate || alignedPeriod.expirationDate !== period.expirationDate) && <div className="mt-2 flex flex-wrap items-center gap-2">
            <span>برای ماه‌های کامل: {formatPersianDate(alignedPeriod.effectiveDate)} تا {formatPersianDate(alignedPeriod.expirationDate)}؛ تغییر شروع، تاریخ آغاز تعهد را نیز تغییر می‌دهد.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(alignedPeriod)}>اعمال بازه ماهانه کامل</Button>
          </div>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">تاریخ شروع *</Label>
          <PersianDatePicker
            id="effectiveDate"
            maxExclusiveDate={period.expirationDate}
            value={period.effectiveDate}
            onChange={(value) => onChange({ ...period, effectiveDate: value })}
            invalid={issue?.field === "effectiveDate"}
            required
          />
          <p className="text-xs text-muted-foreground">برای فعال‌سازی فوری، تاریخ شروع باید امروز یا قبل از آن باشد.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expirationDate">تاریخ پایان *</Label>
          <PersianDatePicker
            id="expirationDate"
            minExclusiveDate={period.effectiveDate}
            value={period.expirationDate}
            onChange={(value) => onChange({ ...period, expirationDate: value })}
            invalid={issue?.field === "expirationDate"}
            required
          />
          <p className="text-xs text-muted-foreground">پایان باید بعد از شروع، در آینده و داخل اعتبار نرخ‌نامه باشد.</p>
        </div>
      </div>

      {issue && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {issue.message} پیشنهاد فعلی: {formatPersianDate(suggestedPeriod.effectiveDate)} تا {formatPersianDate(suggestedPeriod.expirationDate)}.
        </div>
      )}
    </div>
  );
}
