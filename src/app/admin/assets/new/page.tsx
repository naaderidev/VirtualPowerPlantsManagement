"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, Zap } from "lucide-react";

interface Party {
  id: string;
  displayName: string;
  type: string;
}

const assetTypeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

const iranProvinces = [
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "اصفهان",
  "البرز",
  "ایلام",
  "بوشهر",
  "تهران",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان رضوی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "فارس",
  "قزوین",
  "قم",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
];

export default function NewAssetPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ownerId: "",
    name: "",
    type: "SOLAR",
    province: "",
    city: "",
    address: "",
    gridCompany: "",
    connectionPoint: "",
    capacityNominal: "",
    capacitySellable: "",
    technology: "",
  });

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const res = await fetch("/api/parties");
      if (res.ok) {
        const data = await res.json();
        setParties(data.parties || data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          capacityNominal: parseFloat(formData.capacityNominal),
          capacitySellable: formData.capacitySellable
            ? parseFloat(formData.capacitySellable)
            : parseFloat(formData.capacityNominal),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err, "خطا در ایجاد دارایی"));
      }

      router.push("/admin/assets");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
      <div className="flex items-center gap-4">
        <Link
          href="/admin/assets"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">ایجاد دارایی جدید</h1>
          <p className="text-muted-foreground">نیروگاه جدید را ثبت کنید</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            اطلاعات نیروگاه
          </CardTitle>
          <CardDescription>مشخصات کلی نیروگاه را وارد کنید</CardDescription>
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
                <Label htmlFor="owner">مالک نیروگاه *</Label>
                <SelectWithLabels
                  value={formData.ownerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, ownerId: value || "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب مالک" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">نام نیروگاه *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="مثال: نیروگاه خورشیدی مشهد"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">نوع نیروگاه *</Label>
                <SelectWithLabels
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value || "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacityNominal">ظرفیت نامی (kW) *</Label>
                <Input
                  id="capacityNominal"
                  type="number"
                  value={formData.capacityNominal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacityNominal: e.target.value,
                    })
                  }
                  placeholder="مثال: 600"
                  required
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacitySellable">ظرفیت قابل فروش (kW)</Label>
                <Input
                  id="capacitySellable"
                  type="number"
                  value={formData.capacitySellable}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacitySellable: e.target.value,
                    })
                  }
                  placeholder="پیش‌فرض: ظرفیت نامی"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="technology">تکنولوژی</Label>
                <Input
                  id="technology"
                  value={formData.technology}
                  onChange={(e) =>
                    setFormData({ ...formData, technology: e.target.value })
                  }
                  placeholder="مثال: پلی کریستال"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">استان *</Label>
                <SelectWithLabels
                  value={formData.province}
                  onValueChange={(value) =>
                    setFormData({ ...formData, province: value || "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب استان" />
                  </SelectTrigger>
                  <SelectContent>
                    {iranProvinces.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">شهر *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="مثال: مشهد"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">آدرس</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="آدرس دقیق نیروگاه"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gridCompany">شرکت برق منطقه‌ای</Label>
                <Input
                  id="gridCompany"
                  value={formData.gridCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, gridCompany: e.target.value })
                  }
                  placeholder="مثال: توانیر"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="connectionPoint">نقطه اتصال</Label>
                <Input
                  id="connectionPoint"
                  value={formData.connectionPoint}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      connectionPoint: e.target.value,
                    })
                  }
                  placeholder="مثال: پست 230 کیلوولت"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 ml-2" />
                )}
                ایجاد دارایی
              </Button>
              <Link href="/admin/assets">
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
