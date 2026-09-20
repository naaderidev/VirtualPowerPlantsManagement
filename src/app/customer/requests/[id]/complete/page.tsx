"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowRight, Save, Send } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { canCompleteRequestInformation } from "@/domain/requests/workflow";
import { formatApiDate } from "@/lib/persian-date";

const monthFields = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const monthLabels = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export default function CompleteInformationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");
  const [caseNumber, setCaseNumber] = useState("");
  const [assetType, setAssetType] = useState("SOLAR");
  const [operationalStatus, setOperationalStatus] = useState("ACTIVE");
  const [hasExistingContract, setHasExistingContract] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditable, setIsEditable] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    // Identity
    internalCode: "",
    displayName: "",
    
    // Ownership
    ownershipType: "FULL",
    ownershipPercent: "100",
    requesterRole: "OWNER",
    
    // Location
    province: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    gridCompany: "",
    connectionPoint: "",
    
    // Technical
    technology: "",
    capacityNominal: "",
    capacitySellable: "",
    operationalDate: "",
    connectionStatus: "",
    
    // Metering
    mainMeterSerial: "",
    mainMeterModel: "",
    backupMeterSerial: "",
    backupMeterModel: "",
    readInterval: "DAILY",
    dataSource: "SMART_METER",
    
    // Generation Profile
    jan: "",
    feb: "",
    mar: "",
    apr: "",
    may: "",
    jun: "",
    jul: "",
    aug: "",
    sep: "",
    oct: "",
    nov: "",
    dec: "",
    generationYear: formatApiDate(new Date(), "effectiveDate").slice(0, 4),
    generationMethod: "برآورد فروشنده",
    generationSource: "",

    // Existing sales contract
    existingContractStart: "",
    existingContractEnd: "",
    existingContractCounterparty: "",
    existingContractCommittedCapacity: "",
    existingContractExclusive: false,
    existingContractRestrictions: "",
    existingContractRightToSellConfirmed: false,
  });

  useEffect(() => {
    async function loadRequest() {
      const response = await fetch(`/api/requests/${id}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(getApiErrorMessage(payload, "خطا در دریافت اطلاعات درخواست."));
        return;
      }

      setCaseNumber(payload.caseNumber);
      setIsEditable(canCompleteRequestInformation(payload.status));
      setAssetType(payload.plantType);
      setOperationalStatus(payload.operationalStatus);
      setHasExistingContract(payload.hasExistingContract);
      setFormData((current) => ({
        ...current,
        displayName: payload.asset?.name ?? `نیروگاه ${payload.caseNumber}`,
        internalCode: payload.asset?.internalCode ?? "",
        province: payload.asset?.province ?? payload.province,
        city: payload.asset?.city ?? payload.city,
        address: payload.asset?.address ?? "",
        latitude: payload.asset?.latitude?.toString() ?? "",
        longitude: payload.asset?.longitude?.toString() ?? "",
        gridCompany: payload.asset?.gridCompany ?? "",
        connectionPoint: payload.asset?.connectionPoint ?? "",
        connectionStatus: payload.asset?.connectionStatus ?? "",
        capacityNominal: payload.asset?.capacityNominal?.toString() ?? payload.capacity.toString(),
        capacitySellable: payload.asset?.capacitySellable?.toString() ?? payload.capacity.toString(),
        ownershipPercent: payload.asset?.ownershipPercent?.toString() ?? "100",
        requesterRole: payload.asset?.requesterRole ?? "OWNER",
        technology: payload.asset?.technology ?? "",
        operationalDate: payload.asset?.operationalDate?.slice(0, 10) ?? "",
        mainMeterSerial: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "MAIN")?.serialNumber ?? "",
        mainMeterModel: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "MAIN")?.model ?? "",
        backupMeterSerial: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "BACKUP")?.serialNumber ?? "",
        backupMeterModel: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "BACKUP")?.model ?? "",
        readInterval: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "MAIN")?.readInterval ?? current.readInterval,
        dataSource: payload.asset?.meters?.find((meter: { type: string }) => meter.type === "MAIN")?.dataSource ?? current.dataSource,
        generationYear: payload.asset?.generationProfile?.year?.toString() ?? current.generationYear,
        generationMethod: payload.asset?.generationProfile?.method ?? current.generationMethod,
        generationSource: payload.asset?.generationProfile?.source ?? "",
        existingContractStart: payload.existingContractStart?.slice(0, 10) ?? "",
        existingContractEnd: payload.existingContractEnd?.slice(0, 10) ?? "",
        existingContractCounterparty: payload.existingContractCounterparty ?? "",
        existingContractCommittedCapacity: payload.existingContractCommittedCapacity?.toString() ?? "",
        existingContractExclusive: payload.existingContractExclusive ?? false,
        existingContractRestrictions: payload.existingContractRestrictions ?? "",
        existingContractRightToSellConfirmed: payload.existingContractRightToSellConfirmed ?? false,
        ...Object.fromEntries(monthFields.map((month) => [month, payload.asset?.generationProfile?.[month]?.toString() ?? ""])),
      }));
    }

    void loadRequest();
  }, [id]);

  const buildPayload = (mode: "SAVE_DRAFT" | "SUBMIT") => {
    const meters = [
      formData.mainMeterSerial
        ? { type: "MAIN", serialNumber: formData.mainMeterSerial, model: formData.mainMeterModel || null, readInterval: formData.readInterval, dataSource: formData.dataSource }
        : null,
      formData.backupMeterSerial
        ? { type: "BACKUP", serialNumber: formData.backupMeterSerial, model: formData.backupMeterModel || null, readInterval: formData.readInterval, dataSource: formData.dataSource }
        : null,
    ].filter(Boolean);
    const hasGenerationProfile = monthFields.some((month) => formData[month] !== "");

    return {
      mode,
      asset: {
        internalCode: formData.internalCode || null,
        name: formData.displayName,
        type: assetType,
        ownershipPercent: Number(formData.ownershipPercent),
        requesterRole: formData.requesterRole,
        province: formData.province,
        city: formData.city,
        address: formData.address || null,
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
        gridCompany: formData.gridCompany || null,
        connectionPoint: formData.connectionPoint || null,
        connectionStatus: formData.connectionStatus || null,
        capacityNominal: Number(formData.capacityNominal),
        capacitySellable: Number(formData.capacitySellable),
        technology: formData.technology || null,
        operationalDate: formData.operationalDate || null,
      },
      meters,
      generationProfile: hasGenerationProfile
        ? {
            year: Number(formData.generationYear),
            method: formData.generationMethod,
            source: formData.generationSource || null,
            ...Object.fromEntries(monthFields.map((month) => [month, Number(formData[month] || 0)])),
          }
        : null,
      existingContract: hasExistingContract
        ? {
            startDate: formData.existingContractStart,
            endDate: formData.existingContractEnd,
            counterparty: formData.existingContractCounterparty,
            committedCapacity: Number(formData.existingContractCommittedCapacity),
            exclusive: formData.existingContractExclusive,
            restrictions: formData.existingContractRestrictions || null,
            rightToSellConfirmed: formData.existingContractRightToSellConfirmed,
          }
        : null,
    };
  };

  const saveInformation = async (mode: "SAVE_DRAFT" | "SUBMIT") => {
    setError("");
    setMessage("");
    const response = await fetch(`/api/requests/${id}/complete`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(mode)),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(getApiErrorMessage(payload, "ذخیره اطلاعات ناموفق بود."));
    return payload;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await saveInformation("SAVE_DRAFT");
      setMessage("اطلاعات ذخیره شد.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "ذخیره اطلاعات ناموفق بود.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await saveInformation("SUBMIT");
      router.push(`/customer/requests/${id}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "ارسال اطلاعات ناموفق بود.");
      setIsSubmitting(false);
    }
  };

  if (isEditable === false) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>اطلاعات نیروگاه قفل شده است</CardTitle>
          <CardDescription>
            پس از ارسال اطلاعات، مشخصات تأییدشده فقط با درخواست اصلاح کارشناس دوباره قابل ویرایش می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/customer/requests/${id}`}>
            <Button variant="outline">بازگشت به جزئیات درخواست</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/customer/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">تکمیل اطلاعات نیروگاه</h1>
          <p className="text-muted-foreground">
            درخواست {caseNumber || "..."} — اطلاعات کامل نیروگاه را وارد کنید
          </p>
        </div>
      </div>

      {operationalStatus !== "ACTIVE" && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>برای این نیروگاه تاریخ پیش‌بینی‌شده بهره‌برداری و نمایه تولید مهندسی را ثبت کنید. اطلاعات کنتور و اتصال در این مرحله اختیاری است، اما پیش از فعال‌سازی قرارداد باید تکمیل و تأیید شود.</p>
        </div>
      )}

      {hasExistingContract && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-base">اطلاعات قرارداد فروش موجود</CardTitle>
            <CardDescription>
              این اطلاعات فقط برای کنترل هم‌پوشانی و ظرفیت آزاد استفاده می‌شود و مانع ادامه اصل درخواست نیست.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="existingContractStart">تاریخ شروع قرارداد *</Label>
                <PersianDatePicker id="existingContractStart" maxDate={formatApiDate(new Date(), "existingContractStart")} maxExclusiveDate={formData.existingContractEnd} value={formData.existingContractStart} onChange={(value) => setFormData({ ...formData, existingContractStart: value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="existingContractEnd">تاریخ پایان قرارداد *</Label>
                <PersianDatePicker id="existingContractEnd" minExclusiveDate={formData.existingContractStart} value={formData.existingContractEnd} onChange={(value) => setFormData({ ...formData, existingContractEnd: value })} />
                <p className="text-xs text-muted-foreground">تاریخ واقعی پایان را از قرارداد موجود بردارید؛ روز شروع و قبل از آن قفل شده‌اند.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="existingContractCounterparty">طرف قرارداد موجود *</Label>
                <Input id="existingContractCounterparty" value={formData.existingContractCounterparty} onChange={(event) => setFormData({ ...formData, existingContractCounterparty: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="existingContractCommittedCapacity">ظرفیت متعهدشده (کیلووات) *</Label>
                <Input id="existingContractCommittedCapacity" type="number" min="0" value={formData.existingContractCommittedCapacity} onChange={(event) => setFormData({ ...formData, existingContractCommittedCapacity: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="existingContractRestrictions">محدودیت‌ها و تعهدهای قرارداد موجود</Label>
              <Textarea id="existingContractRestrictions" value={formData.existingContractRestrictions} onChange={(event) => setFormData({ ...formData, existingContractRestrictions: event.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-background p-3 text-sm">
              <span>قرارداد موجود انحصاری است</span>
              <Switch checked={formData.existingContractExclusive} onCheckedChange={(checked) => setFormData({ ...formData, existingContractExclusive: checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border bg-background p-3 text-sm">
              <span>حق فروش ظرفیت آزاد به برقتو را تأیید می‌کنم *</span>
              <Switch checked={formData.existingContractRightToSellConfirmed} onCheckedChange={(checked) => setFormData({ ...formData, existingContractRightToSellConfirmed: checked })} />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="identity">شناسه</TabsTrigger>
          <TabsTrigger value="ownership">مالکیت</TabsTrigger>
          <TabsTrigger value="location">مکان</TabsTrigger>
          <TabsTrigger value="technical">فنی</TabsTrigger>
          <TabsTrigger value="metering">اندازه‌گیری</TabsTrigger>
          <TabsTrigger value="generation">تولید</TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>شناسه نیروگاه</CardTitle>
              <CardDescription>اطلاعات پایه نیروگاه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="internalCode">شناسه داخلی</Label>
                  <Input
                    id="internalCode"
                    placeholder="اختیاری"
                    value={formData.internalCode}
                    onChange={(e) => setFormData({ ...formData, internalCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">نام نمایشی *</Label>
                  <Input
                    id="displayName"
                    placeholder="مثال: نیروگاه خورشیدی منزل"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ownership Tab */}
        <TabsContent value="ownership">
          <Card>
            <CardHeader>
              <CardTitle>مالکیت</CardTitle>
              <CardDescription>اطلاعات مالکیت نیروگاه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>نوع مالکیت</Label>
                <RadioGroup
                  value={formData.ownershipType}
                  onValueChange={(value) => setFormData({ ...formData, ownershipType: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="FULL" id="full" />
                    <Label htmlFor="full" className="cursor-pointer">مالک کامل</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="SHARED" id="shared" />
                    <Label htmlFor="shared" className="cursor-pointer">مالک مشترک</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.ownershipType === "SHARED" && (
                <div className="space-y-2">
                  <Label htmlFor="ownershipPercent">درصد مالکیت</Label>
                  <Input
                    id="ownershipPercent"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.ownershipPercent}
                    onChange={(e) => setFormData({ ...formData, ownershipPercent: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label>نقش درخواست‌دهنده</Label>
                <RadioGroup
                  value={formData.requesterRole}
                  onValueChange={(value) => setFormData({ ...formData, requesterRole: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="OWNER" id="owner" />
                    <Label htmlFor="owner" className="cursor-pointer">مالک</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="REPRESENTATIVE" id="rep" />
                    <Label htmlFor="rep" className="cursor-pointer">نماینده مجاز</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>مکان</CardTitle>
              <CardDescription>موقعیت فیزیکی نیروگاه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="province">استان *</Label>
                  <Input
                    id="province"
                    placeholder="مثال: تهران"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">شهر *</Label>
                  <Input
                    id="city"
                    placeholder="مثال: ری"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">آدرس</Label>
                <Textarea
                  id="address"
                  placeholder="آدرس کامل"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">عرض جغرافیایی</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="مثال: 35.6892"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">طول جغرافیایی</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="مثال: 51.3890"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gridCompany">شرکت برق مرتبط</Label>
                  <Input
                    id="gridCompany"
                    placeholder="مثال: توانیر"
                    value={formData.gridCompany}
                    onChange={(e) => setFormData({ ...formData, gridCompany: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="connectionPoint">نقطه اتصال</Label>
                  <Input
                    id="connectionPoint"
                    placeholder="مثال: پست برق ABC"
                    value={formData.connectionPoint}
                    onChange={(e) => setFormData({ ...formData, connectionPoint: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical">
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات فنی</CardTitle>
              <CardDescription>مشخصات فنی نیروگاه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="technology">فناوری</Label>
                  <Input
                    id="technology"
                    placeholder="مثال: PV"
                    value={formData.technology}
                    onChange={(e) => setFormData({ ...formData, technology: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operationalDate">{operationalStatus === "ACTIVE" ? "تاریخ بهره‌برداری واقعی *" : "تاریخ پیش‌بینی‌شده بهره‌برداری *"}</Label>
                  <PersianDatePicker
                    id="operationalDate"
                    minDate={operationalStatus === "ACTIVE" ? undefined : formatApiDate(new Date(), "operationalDate")}
                    maxDate={operationalStatus === "ACTIVE" ? formatApiDate(new Date(), "operationalDate") : undefined}
                    value={formData.operationalDate}
                    onChange={(value) => setFormData({ ...formData, operationalDate: value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacityNominal">ظرفیت نامی (کیلووات) *</Label>
                  <Input
                    id="capacityNominal"
                    type="number"
                    placeholder="مثال: 50"
                    value={formData.capacityNominal}
                    onChange={(e) => setFormData({ ...formData, capacityNominal: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacitySellable">ظرفیت قابل فروش (کیلووات) *</Label>
                  <Input
                    id="capacitySellable"
                    type="number"
                    placeholder="مثال: 50"
                    value={formData.capacitySellable}
                    onChange={(e) => setFormData({ ...formData, capacitySellable: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>وضعیت اتصال</Label>
                <RadioGroup
                  value={formData.connectionStatus}
                  onValueChange={(value) => setFormData({ ...formData, connectionStatus: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="CONNECTED" id="connected" />
                    <Label htmlFor="connected" className="cursor-pointer">متصل</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="PENDING" id="pending" />
                    <Label htmlFor="pending" className="cursor-pointer">در انتظار اتصال</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="NOT_CONNECTED" id="notConnected" />
                    <Label htmlFor="notConnected" className="cursor-pointer">غیرمتصل</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metering Tab */}
        <TabsContent value="metering">
          <Card>
            <CardHeader>
              <CardTitle>اندازه‌گیری</CardTitle>
              <CardDescription>اطلاعات کنتور و اندازه‌گیری</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Meter */}
              <div className="space-y-4">
                <h4 className="font-medium">کنتور اصلی</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mainMeterSerial">شماره سریال</Label>
                    <Input
                      id="mainMeterSerial"
                      placeholder="شماره سریال کنتور"
                      value={formData.mainMeterSerial}
                      onChange={(e) => setFormData({ ...formData, mainMeterSerial: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mainMeterModel">مدل</Label>
                    <Input
                      id="mainMeterModel"
                      placeholder="مدل کنتور"
                      value={formData.mainMeterModel}
                      onChange={(e) => setFormData({ ...formData, mainMeterModel: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Backup Meter */}
              <div className="space-y-4">
                <h4 className="font-medium">کنتور پشتیبان (اختیاری)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="backupMeterSerial">شماره سریال</Label>
                    <Input
                      id="backupMeterSerial"
                      placeholder="شماره سریال کنتور پشتیبان"
                      value={formData.backupMeterSerial}
                      onChange={(e) => setFormData({ ...formData, backupMeterSerial: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backupMeterModel">مدل</Label>
                    <Input
                      id="backupMeterModel"
                      placeholder="مدل کنتور پشتیبان"
                      value={formData.backupMeterModel}
                      onChange={(e) => setFormData({ ...formData, backupMeterModel: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Reading Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">تنظیمات قرائت</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>بازه قرائت</Label>
                    <RadioGroup
                      value={formData.readInterval}
                      onValueChange={(value) => setFormData({ ...formData, readInterval: value })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="HOURLY" id="hourly" />
                        <Label htmlFor="hourly" className="cursor-pointer">ساعتی</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="DAILY" id="daily" />
                        <Label htmlFor="daily" className="cursor-pointer">روزانه</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="MONTHLY" id="monthly" />
                        <Label htmlFor="monthly" className="cursor-pointer">ماهانه</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-3">
                    <Label>منبع داده</Label>
                    <RadioGroup
                      value={formData.dataSource}
                      onValueChange={(value) => setFormData({ ...formData, dataSource: value })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="SMART_METER" id="smartMeter" />
                        <Label htmlFor="smartMeter" className="cursor-pointer">کنتور هوشمند</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="API" id="api" />
                        <Label htmlFor="api" className="cursor-pointer">API</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="MANUAL" id="manual" />
                        <Label htmlFor="manual" className="cursor-pointer">دستی</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generation">
          <Card>
            <CardHeader>
              <CardTitle>پیش‌بینی تولید دوازده‌ماهه</CardTitle>
              <CardDescription>مقادیر انرژی مورد انتظار را به کیلووات‌ساعت وارد کنید.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="generationYear">سال</Label>
                  <Input id="generationYear" type="number" value={formData.generationYear} onChange={(event) => setFormData({ ...formData, generationYear: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generationMethod">روش برآورد</Label>
                  <Input id="generationMethod" value={formData.generationMethod} onChange={(event) => setFormData({ ...formData, generationMethod: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generationSource">منبع</Label>
                  <Input id="generationSource" value={formData.generationSource} onChange={(event) => setFormData({ ...formData, generationSource: event.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {monthFields.map((month, index) => (
                  <div className="space-y-2" key={month}>
                    <Label htmlFor={month}>{monthLabels[index]}</Label>
                    <Input id={month} type="number" min="0" value={formData[month]} onChange={(event) => setFormData({ ...formData, [month]: event.target.value })} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700" role="status">{message}</p>}

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <Link href={`/customer/requests/${id}`}>
          <Button type="button" variant="outline">
            انصراف
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 ml-2" />
            {isSaving ? "در حال ذخیره..." : "ذخیره اطلاعات"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 ml-2" />
            {isSubmitting ? "در حال ارسال..." : "ارسال اطلاعات"}
          </Button>
        </div>
      </div>
    </div>
  );
}
