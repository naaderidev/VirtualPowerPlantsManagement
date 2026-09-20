import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { redirect } from "next/navigation";

const roleLabels: Record<string, string> = {
  ADMIN: "مدیر اصلی",
  STAFF_SUPPLY: "کارشناس تأمین",
  STAFF_TECHNICAL: "کارشناس فنی",
  STAFF_LEGAL: "کارشناس حقوقی",
  STAFF_FINANCIAL: "کارشناس مالی",
  MANAGER: "مدیر",
  CUSTOMER: "فروشنده",
  CUSTOMER_REPRESENTATIVE: "نماینده مشتری",
};

export default async function UsersPage() {
  const viewer = await getAuthenticatedUser();
  if (viewer?.role !== "ADMIN") redirect("/admin/dashboard");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, mobile: true, email: true, role: true, active: true, lastLogin: true, party: { select: { displayName: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">کاربران سامانه</h1><p className="text-muted-foreground">حساب‌های واقعی موجود در دیتابیس؛ بدون داده نمایشی</p></div>
      <Card><CardHeader><CardTitle>کاربران ({users.length.toLocaleString("fa-IR")})</CardTitle></CardHeader><CardContent>
        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">هنوز کاربری ایجاد نشده است.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-right">نام</th><th className="p-3 text-right">موبایل</th><th className="p-3 text-right">نقش</th><th className="p-3 text-right">طرف تجاری</th><th className="p-3 text-right">وضعیت</th><th className="p-3 text-right">آخرین ورود</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t"><td className="p-3"><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email ?? "بدون ایمیل"}</div></td><td className="p-3" dir="ltr">{user.mobile}</td><td className="p-3"><Badge variant="secondary">{roleLabels[user.role] ?? "نقش نامشخص"}</Badge></td><td className="p-3">{user.party?.displayName ?? "تکمیل نشده"}</td><td className="p-3"><Badge status={user.active ? "ACTIVE" : "INACTIVE"}>{user.active ? "فعال" : "غیرفعال"}</Badge></td><td className="p-3">{user.lastLogin ? formatPersianDate(user.lastLogin) : "هنوز وارد نشده"}</td></tr>)}</tbody></table></div>
        )}
      </CardContent></Card>
    </div>
  );
}
import { formatPersianDate } from "@/lib/persian-date";
