import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const protectedPaths = ["/documents/new", "/documents/edit", "/api/keys"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!needsAuth) return NextResponse.next();

  const session = await auth();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/documents/new", "/documents/:path*/edit", "/api/keys/:path*"],
};
