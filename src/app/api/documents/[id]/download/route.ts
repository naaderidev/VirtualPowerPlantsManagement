import { readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { NextResponse } from "next/server";
import { DOCUMENT_ACCESS_ROLES, canAccessParty } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { apiError } from "@/lib/api-response";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(DOCUMENT_ACCESS_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const document = await prisma.requestDocument.findUnique({
    where: { id },
    include: { request: { select: { partyId: true } } },
  });

  if (!document) {
    return apiError(404, "NOT_FOUND", "مدرک پیدا نشد.", { request });
  }
  if (!canAccessParty(auth.user, document.request.partyId)) return forbiddenResponse();

  const storedName = basename(document.fileUrl);
  const isLegacyUpload = document.fileUrl.startsWith("/uploads/");
  const filePath = isLegacyUpload
    ? join(process.cwd(), "public", "uploads", document.requestId, storedName)
    : join(process.cwd(), "storage", "uploads", document.requestId, storedName);

  try {
    const bytes = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(storedName).toLowerCase()] ?? "application/octet-stream";
    const encodedName = encodeURIComponent(document.fileName);
    const disposition = new URL(request.url).searchParams.get("preview") === "1"
      ? "inline"
      : "attachment";

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return apiError(404, "NOT_FOUND", "فایل مدرک پیدا نشد.", { request });
  }
}
