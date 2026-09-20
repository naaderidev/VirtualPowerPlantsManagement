"use client";

import { formatApiDate, formatPersianDate } from "@/lib/persian-date";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectWithLabels,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";

type RepresentationState = "CURRENT" | "SCHEDULED" | "EXPIRED" | "REVOKED";
type StateFilter = "ALL" | RepresentationState;

type RepresentativeOption = {
  id: string;
  name: string;
  mobile: string;
  partyId: string | null;
};

type CompanyOption = {
  id: string;
  displayName: string;
  nationalId: string | null;
};

type Assignment = {
  id: string;
  representativeUser: {
    id: string;
    name: string;
    mobile: string;
    active: boolean;
  } | null;
  representativeParty: { id: string; displayName: string };
  company: { id: string; displayName: string; status: string };
  state: RepresentationState;
  active: boolean;
  validFrom: string;
  validTo: string | null;
  canSign: boolean;
  authorityReference: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  revokedBy: { id: string; name: string } | null;
  revokedAt: string | null;
};

type RepresentativesResponse = {
  assignments: Assignment[];
  options: {
    representativeUsers: RepresentativeOption[];
    companies: CompanyOption[];
  };
  pagination: { total: number };
};

type AssignmentForm = {
  representativeUserId: string;
  companyPartyId: string;
  validFrom: string;
  validTo: string;
  canSign: boolean;
  authorityReference: string;
  notes: string;
};

const emptyForm: AssignmentForm = {
  representativeUserId: "",
  companyPartyId: "",
  validFrom: formatApiDate(new Date(), "validFrom"),
  validTo: "",
  canSign: false,
  authorityReference: "",
  notes: "",
};

const stateLabels: Record<RepresentationState, string> = {
  CURRENT: "معتبر",
  SCHEDULED: "زمان‌بندی‌شده",
  EXPIRED: "منقضی",
  REVOKED: "لغوشده",
};

const stateVariants: Record<
  RepresentationState,
  "default" | "secondary" | "outline" | "destructive"
> = {
  CURRENT: "default",
  SCHEDULED: "secondary",
  EXPIRED: "outline",
  REVOKED: "destructive",
};

function formatDate(value: string | null) {
  return value ? formatPersianDate(value) : "بدون تاریخ پایان";
}

function toPayload(form: AssignmentForm) {
  return {
    ...form,
    validTo: form.validTo || null,
    authorityReference: form.authorityReference.trim() || null,
    notes: form.notes.trim() || null,
  };
}

type AssignmentFieldsProps = {
  form: AssignmentForm;
  setForm: (form: AssignmentForm) => void;
  representatives: RepresentativeOption[];
  companies: CompanyOption[];
  lockParties?: boolean;
};

function AssignmentFields({
  form,
  setForm,
  representatives,
  companies,
  lockParties = false,
}: Readonly<AssignmentFieldsProps>) {
  const set = <Key extends keyof AssignmentForm>(
    key: Key,
    value: AssignmentForm[Key],
  ) => setForm({ ...form, [key]: value });

  return (
    <div className="grid gap-4 py-2 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="representative-user">حساب نماینده</Label>
        <SelectWithLabels
          value={form.representativeUserId || null}
          onValueChange={(value) => set("representativeUserId", value ?? "")}
          disabled={lockParties}
        >
          <SelectTrigger id="representative-user" className="w-full">
            <SelectValue placeholder="نماینده را انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {representatives.map((representative) => (
              <SelectItem key={representative.id} value={representative.id}>
                {representative.name} —{" "}
                <span dir="ltr">{representative.mobile}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </SelectWithLabels>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="representative-company">شرکت طرف نمایندگی</Label>
        <SelectWithLabels
          value={form.companyPartyId || null}
          onValueChange={(value) => set("companyPartyId", value ?? "")}
          disabled={lockParties}
        >
          <SelectTrigger id="representative-company" className="w-full">
            <SelectValue placeholder="شرکت را انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectWithLabels>
      </div>

      <div className="space-y-2">
        <Label htmlFor="representative-valid-from">شروع اعتبار</Label>
        <PersianDatePicker
          id="representative-valid-from"
          maxDate={form.validTo}
          value={form.validFrom}
          onChange={(value) => set("validFrom", value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="representative-valid-to">پایان اعتبار (اختیاری)</Label>
        <PersianDatePicker
          id="representative-valid-to"
          minDate={form.validFrom}
          value={form.validTo}
          onChange={(value) => set("validTo", value)}
        />
        <p className="text-xs text-muted-foreground">
          پیشنهاد اولیه: شروع اعتبار از امروز و پایان باز؛ اگر در معرفی‌نامه
          تاریخ پایان آمده است، همان تاریخ واقعی را انتخاب کنید.
        </p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="representative-can-sign">
              اختیار امضای قرارداد
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              دسترسی عملیاتی نماینده مستقل از اختیار امضا نگهداری می‌شود.
            </p>
          </div>
          <Switch
            id="representative-can-sign"
            checked={form.canSign}
            onCheckedChange={(checked) => set("canSign", checked)}
          />
        </div>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="representative-authority">
          مرجع اختیار {form.canSign ? "(الزامی)" : "(اختیاری)"}
        </Label>
        <Input
          id="representative-authority"
          value={form.authorityReference}
          onChange={(event) => set("authorityReference", event.target.value)}
          placeholder="مثلاً صورت‌جلسه هیئت‌مدیره شماره ۱۲۳"
          required={form.canSign}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="representative-notes">یادداشت داخلی</Label>
        <Textarea
          id="representative-notes"
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="توضیحات تکمیلی برای سابقه مدیریتی"
        />
      </div>
    </div>
  );
}

export function RepresentativesClient() {
  const [data, setData] = useState<RepresentativesResponse | null>(null);
  const [filter, setFilter] = useState<StateFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [revokingAssignment, setRevokingAssignment] =
    useState<Assignment | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");
  const [form, setForm] = useState<AssignmentForm>(emptyForm);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/representatives?state=${filter}&page=1&limit=100`,
      );
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          getApiErrorMessage(payload, "دریافت نمایندگی‌ها ناموفق بود."),
        );
      setData(payload as RepresentativesResponse);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "دریافت نمایندگی‌ها ناموفق بود.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const stats = useMemo(() => {
    const assignments = data?.assignments ?? [];
    return {
      total: data?.pagination.total ?? 0,
      current: assignments.filter(({ state }) => state === "CURRENT").length,
      signatories: assignments.filter(
        ({ active, canSign }) => active && canSign,
      ).length,
    };
  }, [data]);

  const startCreate = () => {
    setForm({
      ...emptyForm,
      validFrom: formatApiDate(new Date(), "validFrom"),
    });
    setError("");
    setMessage("");
    setCreateOpen(true);
  };

  const startEdit = (assignment: Assignment) => {
    setForm({
      representativeUserId: assignment.representativeUser?.id ?? "",
      companyPartyId: assignment.company.id,
      validFrom: assignment.validFrom.slice(0, 10),
      validTo: assignment.validTo?.slice(0, 10) ?? "",
      canSign: assignment.canSign,
      authorityReference: assignment.authorityReference ?? "",
      notes: assignment.notes ?? "",
    });
    setError("");
    setMessage("");
    setEditAssignment(assignment);
  };

  const validateForm = () => {
    if (!form.representativeUserId || !form.companyPartyId || !form.validFrom) {
      return "نماینده، شرکت و تاریخ شروع را تکمیل کنید.";
    }
    if (form.validTo && form.validTo < form.validFrom) {
      return "تاریخ پایان نمی‌تواند قبل از شروع باشد.";
    }
    if (form.canSign && !form.authorityReference.trim()) {
      return "برای اختیار امضا، مرجع اختیار را وارد کنید.";
    }
    return null;
  };

  const save = async (mode: "create" | "edit") => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const url =
        mode === "create"
          ? "/api/representatives"
          : `/api/representatives/${editAssignment?.id}`;
      const payload =
        mode === "create"
          ? toPayload(form)
          : toPayload({
              ...form,
              representativeUserId: "",
              companyPartyId: "",
            });
      const body =
        mode === "create"
          ? payload
          : {
              validFrom: payload.validFrom,
              validTo: payload.validTo,
              canSign: payload.canSign,
              authorityReference: payload.authorityReference,
              notes: payload.notes,
            };
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const responsePayload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(responsePayload, "ذخیره نمایندگی ناموفق بود."),
        );
      }
      setCreateOpen(false);
      setEditAssignment(null);
      setMessage(
        mode === "create"
          ? "نمایندگی با موفقیت ثبت شد."
          : "نمایندگی به‌روزرسانی شد.",
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ذخیره نمایندگی ناموفق بود.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startRevoke = (assignment: Assignment) => {
    setError("");
    setMessage("");
    setRevokeError("");
    setRevokingAssignment(assignment);
  };

  const revoke = async () => {
    if (!revokingAssignment || isRevoking) return;
    setIsRevoking(true);
    setRevokeError("");
    try {
      const response = await fetch(
        `/api/representatives/${revokingAssignment.id}`,
        { method: "DELETE" },
      );
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          getApiErrorMessage(payload, "لغو نمایندگی ناموفق بود."),
        );
      setRevokingAssignment(null);
      setMessage(
        "نمایندگی لغو شد؛ دسترسی به پرونده‌ها و عملیات شرکت پایان یافت.",
      );
      await load();
    } catch (revokeError) {
      setRevokeError(
        revokeError instanceof Error
          ? revokeError.message
          : "لغو نمایندگی ناموفق بود.",
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const representatives = data?.options.representativeUsers ?? [];
  const companies = data?.options.companies ?? [];
  const canCreate = representatives.length > 0 && companies.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">نمایندگان شرکت‌ها</h1>
          <p className="text-muted-foreground">
            تخصیص نماینده، بازه اعتبار و اختیار امضا برای سناریوی شرکت
            چندنیروگاهی
          </p>
        </div>
        <Button onClick={startCreate} disabled={!canCreate || isLoading}>
          <Plus data-icon="inline-start" />
          ثبت نمایندگی جدید
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">کل سوابق</p>
              <p className="text-2xl font-bold text-cyan-800">
                {stats.total.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-full bg-cyan-800 p-2">
              <UserCog className="size-7 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">نمایندگی معتبر</p>
              <p className="text-2xl font-bold text-teal-600">
                {stats.current.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-full bg-teal-600 p-2">
              <Building2 className="size-7 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">دارای اختیار امضا</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats.signatories.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-full bg-amber-600 p-2">
              <ShieldCheck className="size-7 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div aria-live="polite" className="space-y-2">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
      </div>

      <section aria-label="سوابق نمایندگی" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">سوابق نمایندگی</h2>
            <p className="text-sm text-muted-foreground">
              لغو، سابقه را حذف نمی‌کند و در ممیزی باقی می‌ماند.
            </p>
          </div>
          <SelectWithLabels
            value={filter}
            onValueChange={(value) => {
              setIsLoading(true);
              setFilter((value ?? "ALL") as StateFilter);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              <SelectItem value="CURRENT">معتبر</SelectItem>
              <SelectItem value="SCHEDULED">زمان‌بندی‌شده</SelectItem>
              <SelectItem value="EXPIRED">منقضی</SelectItem>
              <SelectItem value="REVOKED">لغوشده</SelectItem>
            </SelectContent>
          </SelectWithLabels>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="flex justify-center py-12">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !data ? null : data.assignments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <UserCog className="mx-auto mb-3 size-10 text-muted-foreground" />
              <h2 className="font-medium">هنوز نمایندگی ثبت نشده است</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                ابتدا شرکت حقوقی را ثبت کنید؛ سپس حساب «نماینده فروشنده» را به
                آن شرکت متصل کنید.
              </p>
              {companies.length === 0 && (
                <Link
                  href="/admin/parties/new"
                  className={`${buttonVariants({ variant: "outline" })} mt-4`}
                >
                  <Building2 className="size-4" /> ثبت شرکت حقوقی
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.assignments.map((assignment) => (
              <Card key={assignment.id} className="h-full">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                        <UserCog className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {assignment.representativeUser?.name ??
                            assignment.representativeParty.displayName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          نماینده {assignment.company.displayName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        status={assignment.state}
                        variant={stateVariants[assignment.state]}
                      >
                        {stateLabels[assignment.state]}
                      </Badge>
                      {assignment.canSign && (
                        <Badge variant="secondary">
                          <ShieldCheck /> اختیار امضا
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">بازه اعتبار</dt>
                      <dd className="mt-1 flex items-center gap-1">
                        <CalendarDays className="size-4 shrink-0" />
                        {formatDate(assignment.validFrom)} تا{" "}
                        {formatDate(assignment.validTo)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">مرجع اختیار</dt>
                      <dd className="mt-1">
                        {assignment.authorityReference ?? "ثبت نشده"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">شماره همراه</dt>
                      <dd className="mt-1">
                        {assignment.representativeUser?.mobile ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ثبت‌کننده</dt>
                      <dd className="mt-1">
                        {assignment.createdBy?.name ?? "سامانه"}
                      </dd>
                    </div>
                  </dl>
                  {assignment.notes && (
                    <p className="text-sm text-muted-foreground">
                      {assignment.notes}
                    </p>
                  )}
                </CardContent>
                {assignment.active && (
                  <CardFooter className="mt-auto flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(assignment)}
                    >
                      <Pencil /> ویرایش
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => startRevoke(assignment)}
                    >
                      <Ban /> لغو نمایندگی
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>ثبت نمایندگی جدید</DialogTitle>
            <DialogDescription>
              نماینده را به شرکت متصل و حدود اختیار او را مشخص کنید.
            </DialogDescription>
          </DialogHeader>
          <AssignmentFields
            form={form}
            setForm={setForm}
            representatives={representatives}
            companies={companies}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button onClick={() => void save("create")} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />} ذخیره نمایندگی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editAssignment)}
        onOpenChange={(open) => !open && setEditAssignment(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>ویرایش حدود نمایندگی</DialogTitle>
            <DialogDescription>
              نماینده و شرکت ثابت‌اند؛ بازه و اختیار را به‌روزرسانی کنید.
            </DialogDescription>
          </DialogHeader>
          <AssignmentFields
            form={form}
            setForm={setForm}
            representatives={representatives}
            companies={companies}
            lockParties
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssignment(null)}>
              انصراف
            </Button>
            <Button onClick={() => void save("edit")} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />} ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revokingAssignment)}
        onOpenChange={(open) => {
          if (!open && !isRevoking) setRevokingAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>لغو نمایندگی</DialogTitle>
            <DialogDescription>
              نمایندگی{" "}
              {revokingAssignment?.representativeUser?.name ??
                revokingAssignment?.representativeParty.displayName}{" "}
              برای {revokingAssignment?.company.displayName} لغو شود؟
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
            <p>
              دسترسی این نماینده به پرونده‌ها و امضای این شرکت پایان می‌یابد.
              خود شرکت، نیروگاه‌ها، درخواست‌ها و قراردادهایش حذف نمی‌شوند.
            </p>
            <p className="mt-2">
              اعلان‌های مرتبط با پرونده‌ها ممکن است همچنان برای آغازگر پرونده
              باقی بمانند یا ارسال شوند؛ لغو نمایندگی به‌تنهایی این بخش را
              پاک‌سازی نمی‌کند.
            </p>
            <p className="mt-2">
              لغوِ این سابقه دکمهٔ بازگشت ندارد؛ برای اعطای دوبارهٔ دسترسی باید
              نمایندگی جدید ثبت شود.
            </p>
          </div>
          {revokeError && (
            <p role="alert" className="text-sm text-destructive">
              {revokeError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokingAssignment(null)}
              disabled={isRevoking}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() => void revoke()}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              تأیید لغو نمایندگی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
