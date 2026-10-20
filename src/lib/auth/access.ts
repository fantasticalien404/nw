// Decides whether a request sees real values or demo values. Server-only; nothing here reaches the browser.
import { createHash, timingSafeEqual } from "node:crypto";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { demoMultiplier } from "@/lib/demo/multiplier";
import { loadAccessSettings, type AccessSettings } from "@/lib/sheets/access-settings";
import { auth } from "./auth";

export const SEED_COOKIE = "demo-seed";
export const DEFAULT_SEED = "1";
export const MAX_SEED_LENGTH = 64;

/** Cached so the allowlist is not read from Sheets on every request; a failed read grants nobody access. */
async function loadCachedAccessSettings(): Promise<AccessSettings> {
  "use cache";
  cacheLife("minutes");

  try {
    return await loadAccessSettings();
  } catch {
    return { allowedEmails: [], luckySeed: null };
  }
}

/** Constant-time comparison of two secrets. */
function sameSecret(a: string, b: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export type Access = {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  /** Signed in with a verified Google email that is on the allowlist. */
  isAllowedUser: boolean;
  /** The seed the visitor entered, or the default. */
  seed: string;
  /** Allowlisted user or lucky seed: real values. */
  real: boolean;
};

export async function resolveAccess(): Promise<Access> {
  const [session, cookieStore, settings] = await Promise.all([auth(), cookies(), loadCachedAccessSettings()]);
  const user = session?.user ?? null;
  const email = user?.email?.trim().toLowerCase();
  // `||`, not `??`: a cookie deleted in the same request reads back as an empty string.
  const seed = cookieStore.get(SEED_COOKIE)?.value || DEFAULT_SEED;
  const isAllowedUser = Boolean(email && settings.allowedEmails.includes(email));
  const hasLuckySeed = settings.luckySeed !== null && sameSecret(seed, settings.luckySeed);
  return { user, isAllowedUser, seed, real: isAllowedUser || hasLuckySeed };
}

/** 1 for real values, otherwise the seeded demo factor in [0, 2). */
export async function resolveMultiplier() {
  const access = await resolveAccess();
  return access.real ? 1 : demoMultiplier(access.seed, process.env.DEMO_SALT);
}
