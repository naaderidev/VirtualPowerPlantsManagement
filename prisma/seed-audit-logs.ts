import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const staffLegal = await prisma.user.findFirst({ where: { role: "STAFF_LEGAL" } });
  const staffFinancial = await prisma.user.findFirst({ where: { role: "STAFF_FINANCIAL" } });

  if (!admin) { console.log("No admin found"); return; }

  const now = new Date();

  const logs = [
    {
      entityType: "USER",
      entityId: admin.id,
      action: "LOGIN",
      userId: admin.id,
      changes: { description: "ورود به سیستم" },
      ipAddress: "192.168.1.100",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 1 * 86400000),
    },
    {
      entityType: "INVOICE",
      entityId: "INV-2026-001",
      action: "CREATE",
      userId: admin.id,
      changes: { description: "صدور صورتحساب INV-2026-001", amount: 44687500, party: "شرکت انرژی سبز" },
      ipAddress: "192.168.1.100",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 2 * 86400000),
    },
    {
      entityType: "CONTRACT",
      entityId: "CTR-1000",
      action: "UPDATE",
      userId: staffLegal?.id || admin.id,
      changes: { description: "تغییر وضعیت قرارداد به فعال", oldStatus: "SIGNED", newStatus: "ACTIVE" },
      ipAddress: "192.168.1.101",
      userAgent: "Firefox 121.0",
      timestamp: new Date(now.getTime() - 3 * 86400000),
    },
    {
      entityType: "REQUEST",
      entityId: "VPP-125",
      action: "APPROVE",
      userId: admin.id,
      changes: { description: "تأیید درخواست VPP-125", party: "علی رضایی", assetType: "SOLAR" },
      ipAddress: "192.168.1.100",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 4 * 86400000),
    },
    {
      entityType: "REQUEST",
      entityId: "VPP-120",
      action: "REJECT",
      userId: staffLegal?.id || admin.id,
      changes: { description: "رد درخواست VPP-120", party: "محمد حسینی", reason: "اطلاعات ناقص" },
      ipAddress: "192.168.1.101",
      userAgent: "Firefox 121.0",
      timestamp: new Date(now.getTime() - 5 * 86400000),
    },
    {
      entityType: "SETTLEMENT",
      entityId: "STL-001",
      action: "CREATE",
      userId: staffFinancial?.id || admin.id,
      changes: { description: "ایجاد تسویه دوره شهریور", amount: 47400000 },
      ipAddress: "192.168.1.102",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 6 * 86400000),
    },
    {
      entityType: "REPORT",
      entityId: "RPT-FIN-001",
      action: "EXPORT",
      userId: admin.id,
      changes: { description: "خروجی گزارش مالی ماهانه", reportType: "FINANCIAL_MONTHLY" },
      ipAddress: "192.168.1.100",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 7 * 86400000),
    },
    {
      entityType: "METERING",
      entityId: "MTR-003",
      action: "UPDATE",
      userId: admin.id,
      changes: { description: "بروزرسانی قرائت کنتور MTR-003", oldStatus: "RAW", newStatus: "VALIDATED" },
      ipAddress: "192.168.1.100",
      userAgent: "Chrome 120.0",
      timestamp: new Date(now.getTime() - 8 * 86400000),
    },
  ];

  for (const log of logs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`Created ${logs.length} audit logs`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
