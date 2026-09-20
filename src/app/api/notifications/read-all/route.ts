import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { notificationScopeFor } from "@/lib/notification-scope";

export async function PATCH() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const scope = notificationScopeFor(auth.user);
  if (!scope) return apiJson({ updated: 0 });

  const result = await prisma.notification.updateMany({
    where: { ...scope, isRead: false },
    data: { isRead: true },
  });

  return apiJson({ updated: result.count });
}
