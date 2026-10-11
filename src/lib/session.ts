import { SignJWT, jwtVerify } from "jose";

const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 jam, cover 1 shift penuh

export const SESSION_COOKIE_NAME = "ct_session";
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

export type UserRole = "operator" | "foreman" | "supervisor" | "ast. manager";

export interface SessionPayload {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET belum di-set di .env.local / Vercel.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}