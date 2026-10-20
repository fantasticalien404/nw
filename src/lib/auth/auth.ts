// Google OAuth through Auth.js. Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
// Sessions are JWT cookies (no database). Signing in only identifies the user; access.ts decides what they see.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  // The allowlist matches on email, so only verified Google emails may sign in.
  callbacks: { signIn: ({ profile }) => profile?.email_verified === true },
});
