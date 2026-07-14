import { NextRequest, NextResponse } from "next/server";
import { verifyValue } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const protectedRole = pathname.startsWith("/team") || pathname.startsWith("/admin")
    ? "team"
    : pathname.startsWith("/board")
    ? "board"
    : null;

  if (!protectedRole) return NextResponse.next();

  const cookie = req.cookies.get("jajf_session")?.value;
  const role = cookie ? await verifyValue(cookie) : null;

  if (role !== protectedRole) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("for", protectedRole);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/team/:path*", "/board/:path*", "/admin/:path*"],
};
