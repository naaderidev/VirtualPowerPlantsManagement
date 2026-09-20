import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { notificationScopeFor } from "@/lib/notification-scope";
import { updateNotificationSchema } from "@/lib/api-schemas";
import { handleRouteError, parseJsonBody } from "@/lib/api-response";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateNotificationSchema);
    if (!parsed.ok) return parsed.response;
    const scope = notificationScopeFor(auth.user);
    if (!scope) return apiJson({ count: 0 });

    const notification = await prisma.notification.updateMany({
      where: { id, ...scope },
      data: { isRead: parsed.data.isRead },
    });

    return apiJson(notification);
  } catch (error) {
    return handleRouteError(request, error, "update notification");
  }
}
