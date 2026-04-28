import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = (credentials.email as string).toLowerCase();
        
        // MVP: Simple auth check by email. In production, check passwords!
        const user = await prisma.appUser.findUnique({
          where: { email },
        });

        if (user && user.status === 'active') {
          return { id: user.id, email: user.email, name: user.fullName, role: user.role, status: user.status };
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      // Bootstrap superadmin
      if (email === 'info@cayworks.com') {
        const existingAdmin = await prisma.appUser.findUnique({ where: { email } });
        if (!existingAdmin) {
          await prisma.appUser.create({
            data: {
              email,
              fullName: user.name || 'Superadmin',
              role: 'superadmin',
              status: 'active',
              authProviderId: account?.providerAccountId,
            },
          });
        }
      }

      const dbUser = await prisma.appUser.findUnique({ where: { email } });

      if (!dbUser) {
        // Redirect to register if not in db
        return '/register?email=' + encodeURIComponent(email);
      }

      if (dbUser.status !== 'active') {
        return false;
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (token.email) {
        const dbUser = await prisma.appUser.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.status = dbUser.status;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
});
