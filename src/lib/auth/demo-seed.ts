"use server";

import { cookies } from "next/headers";
import { MAX_SEED_LENGTH, SEED_COOKIE } from "./access";

/** Stores the visitor's demo seed in an HTTP-only cookie; an empty seed restores the default. */
export async function setDemoSeed(formData: FormData) {
  const seed = String(formData.get("seed") ?? "").trim().slice(0, MAX_SEED_LENGTH);
  const cookieStore = await cookies();
  if (!seed) {
    cookieStore.delete(SEED_COOKIE);
    return;
  }
  cookieStore.set(SEED_COOKIE, seed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
