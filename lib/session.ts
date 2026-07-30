import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "hr-onboarding-secret"
);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  team: string;
  position?: string;
  isNewHire?: boolean;
};

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
} as const;

export async function generateSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function createSession(user: SessionUser) {
  const token = await generateSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set("session", token, SESSION_COOKIE_OPTS);
}

export { SESSION_COOKIE_OPTS };

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.user as SessionUser;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
