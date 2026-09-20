import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { notificationScopeFor } from "@/lib/notification-scope";
import { requireApiUser } from "@/lib/server-auth";
import { paginationSchema } from "@/lib/api-schemas";
import { handleRouteError, parseSearchParams } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;
    const scope = notificationScopeFor(auth.user);
    if (!scope) return apiJson({ notifications: [], unreadCount: 0 });

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { ...scope, isRead: false } }),
    ]);

    return apiJson({ notifications, unreadCount });
  } catch (error) {
    return handleRouteError(request, error, "fetch notifications");
  }
}
