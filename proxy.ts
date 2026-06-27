import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

// Next.js 16 "proxy" convention. The public app is fully anonymous (no auth),
// so the only thing we guard is the admin area: /admin/* and /api/admin/*.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page + its API must stay reachable without a cookie.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifyAdminToken(token, Date.now());
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
