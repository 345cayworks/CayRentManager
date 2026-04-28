import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Auth.js wiring stub.
 * Role and status are always loaded from application DB; provider claims never define role.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  trustHost: true,
});
