import { apiError, apiJson, handleRouteError } from "@/lib/api-response";
import { NETTING_READ_ROLES } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(NETTING_READ_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const statement = await prisma.nettingStatement.findUnique({
      where: { id },
      select: {
        id: true,
        statementNumber: true,
        amount: true,
        paidAmount: true,
        status: true,
        party: { select: { displayName: true } },
      },
    });
    if (!statement) return apiError(404, "NOT_FOUND", "سند خالص‌سازی پیدا نشد.", { request });
    return apiJson(statement);
  } catch (error) {
    return handleRouteError(request, error, "fetch netting statement");
  }
}
