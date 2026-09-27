import { createHmac, timingSafeEqual } from "crypto";
import type { VercelRequest } from "@vercel/node";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SessionPayload {
  exp: number; // Unix seconds
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function checkMasterPassword(provided: unknown): boolean {
  const masterPassword = process.env.MASTER_PASSWORD;
  if (!masterPassword) {
    console.error("MASTER_PASSWORD environment variable not set");
    return false;
  }
  return typeof provided === "string" && safeEqual(provided, masterPassword);
}

/**
 * Issues a stateless session token: `<base64url payload>.<HMAC-SHA256 signature>`.
 * Rotating SESSION_SECRET invalidates every issued token.
 */
export function createSessionToken(): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ exp } satisfies SessionPayload)).toString("base64url");
  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifySessionToken(token: string): boolean {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function isAuthorizedSessionRequest(req: VercelRequest): boolean {
  const token = getBearerToken(req);
  return token !== null && verifySessionToken(token);
}

/** Vercel cron invocations send `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCronRequest(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const token = getBearerToken(req);
  return !!cronSecret && token !== null && safeEqual(token, cronSecret);
}
