import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) { console.log("No admin found"); return; }

  await prisma.notification.deleteMany({ where: { userId: admin.id } });

  const now = new Date();

  const notifications = [
    {
      title: "صورتحساب جدید صادر شد",
      message: "صورتحساب INV-202609-1389 برای شرکت انرژی سبز صادر شد.",
      type: "INVOICE" as const,
      link: "/admin/invoices/cmttu94o5000jefv7k0knma2q",
      isRead: false,
      createdAt: new Date(now.getTime() - 1 * 86400000),
    },
    {
      title: "پرداخت جدید دریافت شد",
      message: "پرداخت جدید از شرکت انرژی سبز دریافت شد.",
      type: "PAYMENT" as const,
      link: "/admin/invoices/cmttu94o5000jefv7k0knma2q",
      isRead: false,
      createdAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      title: "قرائت کنتور نیاز به بررسی دارد",
      message: "قرائت کنتور از نیروگاه علی رضایی نیاز به بررسی دارد.",
      type: "METERING" as const,
      link: "/admin/metering/cmttws5mh0001rei8i7swi65j",
      isRead: true,
      createdAt: new Date(now.getTime() - 3 * 86400000),
    },
    {
      title: "درخواست جدید دریافت شد",
      message: "درخواست VPP-100 از علی رضایی دریافت شد.",
      type: "REQUEST" as const,
      link: "/admin/requests/cmtsnunsg0001t9kx8ebd0ee5",
      isRead: true,
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      title: "قرارداد CTR-1000 فعال شد",
      message: "قرارداد CTR-1000 با شرکت انرژی سبز فعال شد.",
      type: "CONTRACT" as const,
      link: "/admin/contracts/cmttpo9vz0008efv7rs8qb7j6",
      isRead: true,
      createdAt: new Date(now.getTime() - 7 * 86400000),
    },
    {
      title: "درخواست VPP-102 جدید ثبت شد",
      message: "درخواست VPP-102 از محمد حسینی ثبت شد.",
      type: "REQUEST" as const,
      link: "/admin/requests/cmtu16l9q0001ir4qylp0dvvl",
      isRead: false,
      createdAt: new Date(now.getTime() - 1 * 86400000),
    },
  ];

  for (const n of notifications) {
    await prisma.notification.create({ data: { ...n, userId: admin.id } });
  }
  console.log(`Created ${notifications.length} notifications for admin`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
