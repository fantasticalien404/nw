// Server-only: the salt must never reach the browser, or visitors could compute the multiplier themselves.
import { createHmac } from "node:crypto";

/** Upper bound (exclusive) of the demo multiplier; the multiplier is uniform in [0, DEMO_MULTIPLIER_MAX). */
export const DEMO_MULTIPLIER_MAX = 10;

/** Deterministic multiplier for a seed: HMAC-SHA256(salt, seed) mapped to a uniform fraction of the range. */
export function demoMultiplier(seed: string, salt: string | undefined) {
  if (!salt) throw new Error("Set DEMO_SALT in the environment.");
  const digest = createHmac("sha256", salt).update(seed).digest();
  return (digest.readUIntBE(0, 6) / 2 ** 48) * DEMO_MULTIPLIER_MAX;
}
