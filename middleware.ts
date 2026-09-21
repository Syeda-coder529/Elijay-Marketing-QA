import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "elijay_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

const PROTECTED: { prefix: string; role: string }[] = [
  { prefix: "/admin/dashboard", role: "admin" },
  { prefix: "/publisher/dashboard", role: "publisher" },
  { prefix: "/buyer/dashboard", role: "buyer" }
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = PROTECTED.find((p) => pathname.startsWith(p.prefix));
  if (!match) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return redirectToLogin(req, match.role);

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if ((payload as any).role !== match.role) return redirectToLogin(req, match.role);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req, match.role);
  }
}

function redirectToLogin(req: NextRequest, role: string) {
  const loginPath =
    role === "admin" ? "/admin-secret-1045-login" : role === "publisher" ? "/publisher/login" : "/buyer/login";
  return NextResponse.redirect(new URL(loginPath, req.url));
}

export const config = {
  matcher: ["/admin/dashboard/:path*", "/publisher/dashboard/:path*", "/buyer/dashboard/:path*"]
};
