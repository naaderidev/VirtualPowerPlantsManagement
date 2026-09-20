"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3, FileText, Calendar,
  TrendingUp, Users, Zap, Loader2
} from "lucide-react";

interface FinancialSummary {
  totalSettlements: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  activeContracts: number;
  byStatus: Record<string, number>;
}

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: any;
  href: string;
}

const reportTypes: ReportType[] = [
  {
    id: "financial",
    title: "گزارش مالی",
    description: "صورتحساب‌ها و پرداخت‌ها",
    icon: Zap,
    href: "/admin/reports/financial",
  },
  {
    id: "settlements",
    title: "گزارش تسویه‌ها",
    description: "تسویه‌های دوره‌ای",
    icon: BarChart3,
    href: "/admin/settlements",
  },
  {
    id: "contracts",
    title: "گزارش قراردادها",
    description: "وضعیت قراردادها",
    icon: FileText,
    href: "/admin/contracts",
  },
  {
    id: "parties",
    title: "گزارش طرف‌ها",
    description: "آمار طرف‌ها و دارایی‌ها",
    icon: Users,
    href: "/admin/parties",
  },
];

export default function ReportsPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await fetch("/api/reports/financial");
      if (!response.ok) throw new Error("خطا در دریافت گزارش");
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">گزارش‌ها</h1>
        <p className="text-muted-foreground">تهیه و مشاهده گزارش‌ها</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل تسویه‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">{summary?.totalSettlements || 0}</p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل مبلغ</p>
                <p className="text-2xl font-bold text-teal-600">
                  {((summary?.totalAmount || 0) / 1000000).toFixed(1)} <span className="text-sm">م.ر</span>
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">پرداخت شده</p>
                <p className="text-2xl font-bold text-amber-600">
                  {((summary?.totalPaid || 0) / 1000000).toFixed(1)} <span className="text-sm">م.ر</span>
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <Calendar className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قراردادهای فعال</p>
                <p className="text-2xl font-bold text-pink-700">{summary?.activeContracts || 0}</p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.id} href={report.href}>
              <Card className="cursor-pointer hover:bg-muted/50">
                <CardContent className="">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-800/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      مشاهده
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
