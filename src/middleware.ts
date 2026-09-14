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

  if (!role) {
    if (pathname === "/login") return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(rolePath(role), request.url));
  }

  const home = rolePath(role);
  if (!pathname.startsWith(home) && ["/owner", "/advertiser", "/admin"].some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|billboards|creatives).*)"],
};
