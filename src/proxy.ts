import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    // Sudah login lalu buka /login -> arahkan ke dashboard
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token && (await verifySessionToken(token))) {
        return NextResponse.redirect(new URL("/preforming", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (session) return NextResponse.next();

  // API tanpa sesi -> 401 JSON; halaman -> redirect ke login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ status: false, error: "Belum login" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};