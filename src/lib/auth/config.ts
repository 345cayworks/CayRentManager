import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.status === UserStatus.DISABLED) return false;

      if (email === 'info@cayworks.com') {
        await prisma.user.upsert({
          where: { email },
          update: {
            role: UserRole.SUPERADMIN,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
            disabledAt: null,
            disabledBy: null,
            disabledReason: null,
          },
          create: {
            email,
            name: user.name ?? 'Primary Superadmin',
            fullName: user.name ?? 'Primary Superadmin',
            image: user.image,
            role: UserRole.SUPERADMIN,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        });
      } else if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
      }

      return true;
    },
    async session({ session }) {
      const email = session.user?.email?.toLowerCase();
      if (!email) return session;

      const appUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, status: true, fullName: true },
      });

      if (appUser && session.user) {
        const sessionUser = session.user as typeof session.user & {
          id?: string;
          role?: UserRole;
          status?: UserStatus;
        };
        sessionUser.id = appUser.id;
        sessionUser.role = appUser.role;
        sessionUser.status = appUser.status;
        sessionUser.name = appUser.fullName ?? session.user.name;
      }

      return session;
    },
  },
});
