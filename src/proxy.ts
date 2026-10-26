import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const DEFAULT_AFTER_LOGIN = "/pmc";

/** Hanya izinkan path internal ("/xxx"), tolak URL eksternal seperti "//evil.com". */
function safeRedirect(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return DEFAULT_AFTER_LOGIN;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Sudah login lalu buka /login -> langsung ke tujuan (default: menu PMC)
  if (pathname === "/login") {
    if (session) {
      const target = safeRedirect(request.nextUrl.searchParams.get("redirect"));
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  if (session) return NextResponse.next();

  // API PMC tanpa sesi -> 401 JSON; halaman PMC -> redirect ke login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ status: false, error: "Belum login" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Hanya jalan untuk halaman login dan area PMC (termasuk laporan)
  matcher: ["/login", "/pmc/:path*", "/report/:path*", "/api/pmc/:path*", "/api/report/:path*"],
};