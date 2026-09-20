"use client";

import { CalendarDays } from "lucide-react";
import DatePicker, { type DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persianEn from "react-date-object/locales/persian_en";
import persianFa from "react-date-object/locales/persian_fa";
import { formatApiDate, parseApiDate } from "@/lib/persian-date";
import { dateWithinBounds, effectiveDateBounds } from "@/lib/date-picker-constraints";

type PersianDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  minExclusiveDate?: string;
  maxExclusiveDate?: string;
  required?: boolean;
  disabled?: boolean;
  withTime?: boolean;
  monthOnly?: boolean;
  invalid?: boolean;
};

function normalizePickerValue(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^[۰-۹0-9]{4}[/-]/.test(value) && !/^20\d{2}/.test(value)) return value;
  const parsed = parseApiDate(value);
  return parsed ? formatApiDate(parsed, "effectiveDate") : value;
}

export function PersianDatePicker({
  id,
  value,
  onChange,
  placeholder = "انتخاب تاریخ شمسی",
  minDate,
  maxDate,
  minExclusiveDate,
  maxExclusiveDate,
  required,
  disabled,
  withTime = false,
  monthOnly = false,
  invalid = false,
}: Readonly<PersianDatePickerProps>) {
  const format = monthOnly ? "YYYY-MM" : withTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD";
  const bounds = { minDate, maxDate, minExclusiveDate, maxExclusiveDate, withTime };
  const effectiveBounds = effectiveDateBounds(bounds);

  function handleChange(selectedDate: DateObject | null) {
    if (!selectedDate) {
      onChange("");
      return;
    }
    const selected = selectedDate.convert(persian, persianEn).format(format);
    if (!dateWithinBounds(monthOnly ? `${selected.replace("-", "/")}/01` : selected, bounds)) return false;
    onChange(selected);
  }

  return (
    <div className="relative" data-invalid={invalid || undefined}>
      <DatePicker
        id={id}
        value={normalizePickerValue(value)}
        onChange={handleChange}
        calendar={persian}
        locale={persianFa}
        format={format}
        onlyMonthPicker={monthOnly}
        calendarPosition="bottom-right"
        portal
        containerClassName="vpp-date-picker-container"
        className="vpp-persian-calendar"
        inputClass="vpp-date-picker-input"
        placeholder={placeholder}
        minDate={normalizePickerValue(effectiveBounds.minDate)}
        maxDate={normalizePickerValue(effectiveBounds.maxDate)}
        required={required}
        disabled={disabled}
        editable={false}
        typingTimeout={500}
        zIndex={1000}
        mobileLabels={{ OK: "تأیید", CANCEL: "انصراف" }}
        plugins={withTime ? [<TimePicker key="time" position="bottom" hideSeconds />] : undefined}
      />
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
