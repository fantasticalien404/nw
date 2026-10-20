import Image from "next/image";
import { connection } from "next/server";
import { auth, signIn, signOut } from "@/lib/auth/auth";

const avatar = "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-medium";

/** Navbar profile: Google picture with a green border when signed in, a red placeholder (click to sign in) otherwise. */
export async function UserProfile() {
  await connection();
  const user = (await auth())?.user;

  if (!user) {
    return (
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
          className={`${avatar} cursor-pointer border-red-600 bg-white text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black`}
        >
          ?
        </button>
      </form>
    );
  }

  const label = user.name ?? user.email ?? "Signed in";
  return (
    <>
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
        <button type="submit" className="cursor-pointer px-1 text-zinc-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
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
