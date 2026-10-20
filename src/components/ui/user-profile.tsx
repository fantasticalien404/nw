import Image from "next/image";
import { connection } from "next/server";
import { resolveAccess } from "@/lib/auth/access";
import { signIn, signOut } from "@/lib/auth/auth";
import { setDemoSeed } from "@/lib/auth/demo-seed";
import { DemoNotice } from "./demo-notice";

const avatar = "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-medium";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

/** Demo seed: it picks the factor every amount is multiplied by. The factor itself is never shown. */
function SeedForm({ seed }: { seed: string }) {
  return (
    <form action={setDemoSeed} className="flex items-center gap-1">
      <label htmlFor="demo-seed" className="text-zinc-600">Seed</label>
      <input
        key={seed}
        id="demo-seed"
        name="seed"
        defaultValue={seed}
        maxLength={64}
        autoComplete="off"
        className={`w-20 border border-zinc-300 bg-white px-1.5 py-0.5 text-sm ${focusRing}`}
      />
      <button type="submit" className={`cursor-pointer px-1 text-zinc-600 underline-offset-4 hover:underline ${focusRing}`}>
        Apply
      </button>
    </form>
  );
}

/**
 * Navbar profile: Google picture with a green border when signed in, a red placeholder (click to sign in) otherwise.
 * Anyone who is not an allowlisted user also gets the demo seed input, and a warning icon while the values are randomized.
 */
export async function UserProfile() {
  await connection();
  const { user, isAllowedUser, real, seed } = await resolveAccess();
  const notice = real ? null : <DemoNotice />;
  const seedForm = isAllowedUser ? null : <SeedForm seed={seed} />;

  if (!user) {
    return (
      <>
        {notice}
        {seedForm}
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            title="Sign in with Google"
            aria-label="Sign in with Google"
            className={`${avatar} cursor-pointer border-red-600 bg-white text-zinc-500 ${focusRing}`}
          >
            ?
          </button>
        </form>
      </>
    );
  }

  const label = user.name ?? user.email ?? "Signed in";
  return (
    <>
      {notice}
      {seedForm}
      <span title={label} className={`${avatar} border-green-600 bg-white text-zinc-600`}>
        {user.image ? (
          <Image src={user.image} alt={label} width={28} height={28} unoptimized referrerPolicy="no-referrer" />
        ) : (
          label.charAt(0).toUpperCase()
        )}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button type="submit" className={`cursor-pointer px-1 text-zinc-600 underline-offset-4 hover:underline ${focusRing}`}>
          Sign out
        </button>
      </form>
    </>
  );
}

/** Neutral placeholder shown while the session is read. */
export function UserProfileFallback() {
  return <span className={`${avatar} border-zinc-300`} aria-hidden="true" />;
}
