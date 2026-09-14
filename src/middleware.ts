import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "bx_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-insecure-secret-change-me",
);

async function getRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function rolePath(role: string) {
  return role === "owner" ? "/owner" : role === "advertiser" ? "/advertiser" : "/admin";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await getRole(request);

  // "/" is the public marketing landing page — logged-in visitors get bounced to their
  // workspace, everyone else sees it (this used to redirect straight to /login, which
  // swallowed the landing page entirely).
  if (pathname === "/") {
    if (role) return NextResponse.redirect(new URL(rolePath(role), request.url));
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (role) return NextResponse.redirect(new URL(rolePath(role), request.url));
    return NextResponse.next();
  }

  const protectedRoot = ["/owner", "/advertiser", "/admin"].find((p) => pathname.startsWith(p));
  if (protectedRoot) {
    if (!role) {
      // No hard redirect: let the page render as a blurred preview with a login prompt
      // (AppShell handles the overlay) instead of bouncing straight to /login.
      return NextResponse.next();
    }
    if (protectedRoot !== rolePath(role)) {
      return NextResponse.redirect(new URL(rolePath(role), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|billboards|creatives).*)"],
};
