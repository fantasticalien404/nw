// Google OAuth through Auth.js. Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
// Sessions are JWT cookies (no database). Signing in only identifies the user; nothing is restricted yet.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({ providers: [Google] });
