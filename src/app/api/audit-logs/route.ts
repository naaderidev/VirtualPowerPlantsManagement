import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUDIT_READ_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";

export async function GET() {
  const auth = await requireApiUser(AUDIT_READ_ROLES);
  if (!auth.ok) return auth.response;

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    include: { user: { select: { name: true, mobile: true } } },
    take: 100,
  });

  const total = await prisma.auditLog.count();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await prisma.auditLog.count({
    where: { timestamp: { gte: today } },
  });

  const approveCount = await prisma.auditLog.count({
    where: { action: "APPROVE" },
  });

  const rejectCount = await prisma.auditLog.count({
    where: { action: "REJECT" },
  });

  return apiJson({
    logs,
    stats: { total, todayCount, approveCount, rejectCount },
  });
}
