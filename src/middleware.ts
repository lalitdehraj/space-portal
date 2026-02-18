import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth"];
// OBE routes: allow through without token check; AuthGuard will enforce session on the client and redirect to login if needed.
// This avoids redirect loop when getToken() returns null for /obe in Edge (e.g. cookie/secret timing).
const OBE_PATHS = ["/obe"];
const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files and images
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // Allow public paths (login page and NextAuth API routes)
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow OBE routes through; client-side AuthGuard handles session and redirects to login if unauthenticated
  if (OBE_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // For all other routes, require authentication
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
