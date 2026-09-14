import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "bx_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-insecure-secret-change-me",
);

export type Role = "owner" | "advertiser" | "admin";
export type Session = { userId: string; role: Role };

/** Maps a logged-in advertiser user to the advertiser record they act as. */
export const USER_ADVERTISER_MAP: Record<string, string> = {
  "user-megamart": "adv-megamart",
  "user-quickfood": "adv-quickfood",
  "user-nova": "adv-nova",
};

export async function signSessionToken(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") return null;
    if (!["owner", "advertiser", "admin"].includes(payload.role)) return null;
    return { userId: payload.userId, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: Role) {
  const token = await signSessionToken({ userId, role });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
