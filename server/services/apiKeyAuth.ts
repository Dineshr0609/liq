/**
 * apiKeyAuth — pure HMAC inbound event authentication.
 *
 * Header format (no shared secret in transit):
 *   X-LicenseIQ-Key:       <key_prefix>
 *   X-LicenseIQ-Timestamp: <unix_seconds>
 *   X-LicenseIQ-Signature: hex(hmac_sha256(secret, timestamp + "." + raw_body))
 *
 * The raw secret is encrypted at rest with AES-256-GCM using a key derived
 * from process.env.SESSION_SECRET (or a documented dev fallback). Only the
 * server can compute the expected HMAC; clients keep the secret locally.
 */
import crypto from "crypto";
import type { Request, NextFunction } from "express";
import { db } from "../db";
import { apiKeys } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export interface AuthedKey {
  id: string;
  keyPrefix: string;
  legalEntityId: string | null;
  companyId: string | null;
}

// AES-256-GCM key for stored API key secrets. Derived from a required env var
// so we never silently fall back to a hardcoded default that would weaken
// production storage protection. In a misconfigured environment this throws
// at startup instead of accepting weak material.
const ENC_KEY = (() => {
  const seed = process.env.INBOUND_API_HMAC_KEY || process.env.SESSION_SECRET;
  if (!seed) {
    throw new Error(
      "apiKeyAuth: INBOUND_API_HMAC_KEY (or SESSION_SECRET) must be set — refusing to fall back to a hardcoded default."
    );
  }
  return crypto.createHash("sha256").update(`inbound-events:${seed}`).digest();
})();

function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptStoredSecret(encoded: string): string | null {
  return decryptSecret(encoded);
}

function decryptSecret(encoded: string): string | null {
  try {
    const [version, ivB64, tagB64, ctB64] = encoded.split(":");
    if (version !== "v1") return null;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch { return null; }
}

export function generateApiKey(): { keyPrefix: string; secret: string; encryptedSecret: string; full: string } {
  const keyPrefix = "liq_live_" + crypto.randomBytes(6).toString("hex");
  const secret = crypto.randomBytes(32).toString("hex");
  return { keyPrefix, secret, encryptedSecret: encryptSecret(secret), full: `${keyPrefix}.${secret}` };
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function verifyHmac(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch { return false; }
}

export interface VerifyResult {
  ok: boolean;
  key?: AuthedKey;
  error?: string;
}

export async function verifyInboundRequest(req: Request, rawBody: string): Promise<VerifyResult> {
  const keyPrefix = (req.header("X-LicenseIQ-Key") || "").trim();
  const timestamp = (req.header("X-LicenseIQ-Timestamp") || "").trim();
  const signature = (req.header("X-LicenseIQ-Signature") || "").trim();
  if (!keyPrefix || !timestamp || !signature) return { ok: false, error: "Missing signature headers" };
  // Allow ±10 minute window
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 600) return { ok: false, error: "Timestamp out of range" };

  const [row] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyPrefix, keyPrefix), eq(apiKeys.isActive, true)));
  if (!row) return { ok: false, error: "Unknown or revoked key" };
  // No "dev" signature backdoor — every request (including local/test) must
  // present a real HMAC computed against the stored secret. Tests should use
  // the actual signing helper rather than a magic literal.
  if (!row.encryptedSecret) return { ok: false, error: "Key cannot verify HMAC (no encrypted secret stored)" };
  const secret = decryptSecret(row.encryptedSecret);
  if (!secret) return { ok: false, error: "Key secret could not be decrypted" };
  if (!verifyHmac(secret, timestamp, rawBody, signature)) return { ok: false, error: "Bad signature" };

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { ok: true, key: { id: row.id, keyPrefix: row.keyPrefix, legalEntityId: row.legalEntityId, companyId: row.companyId ?? null } };
}

export function isInternalUser(req: any): boolean {
  return !!req?.user?.id;
}

export function ensureInternalAdmin(req: any, res: any, next: NextFunction) {
  if (!req?.isAuthenticated?.()) return res.status(401).json({ error: "Unauthorized" });
  const role = req.user?.role;
  const isAdmin = req.user?.isSystemAdmin === true || role === "admin" || role === "owner";
  if (!isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}
