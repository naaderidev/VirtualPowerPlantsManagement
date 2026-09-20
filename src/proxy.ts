import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_ROLES, INTERNAL_ROLES, isAppRole } from "@/lib/access-control";
import { canAccessAdminPath } from "@/lib/ui-access";

function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

function isCrossSiteMutation(request: NextRequest): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== request.nextUrl.origin);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function proxyApiError(
  request: NextRequest,
  status: number,
  code: "UNAUTHORIZED" | "FORBIDDEN",
  message: string
): NextResponse {
  const suppliedId = request.headers.get("x-correlation-id");
  const correlationId = suppliedId && /^[A-Za-z0-9._-]{1,100}$/.test(suppliedId)
    ? suppliedId
    : crypto.randomUUID();

  return NextResponse.json(
    { error: { code, message, correlationId } },
    { status, headers: { "x-correlation-id": correlationId } }
  );
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/uploads/")) {
    return new NextResponse(null, { status: 404 });
  }

  if (request.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  if (isApiRequest(request) && isCrossSiteMutation(request)) {
    return proxyApiError(request, 403, "FORBIDDEN", "درخواست بین‌سایتی مجاز نیست.");
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !isAppRole(token.role)) {
    return isApiRequest(request)
      ? proxyApiError(request, 401, "UNAUTHORIZED", "برای ادامه وارد حساب کاربری شوید.")
      : redirectToLogin(request);
  }

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !INTERNAL_ROLES.includes(token.role as (typeof INTERNAL_ROLES)[number])
  ) {
    return NextResponse.redirect(new URL("/customer/dashboard", request.url));
  }

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !canAccessAdminPath(token.role as (typeof INTERNAL_ROLES)[number], request.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  if (
    request.nextUrl.pathname.startsWith("/customer") &&
    !CUSTOMER_ROLES.includes(token.role as (typeof CUSTOMER_ROLES)[number])
  ) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/customer/:path*", "/onboarding/:path*", "/api/:path*", "/uploads/:path*"],
};
