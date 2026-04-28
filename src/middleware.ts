import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// We need to provide a config without Prisma/DB adapters for Edge compatibility in middleware
import { handlers, auth } from '@/lib/auth/config';

const ADMIN_ROUTES = ['/admin'];
const TENANT_ROUTES = ['/tenant'];
const LANDLORD_ROUTES = [
  '/dashboard',
  '/properties',
  '/units',
  '/tenants',
  '/leases',
  '/payments',
  '/expenses',
  '/maintenance',
  '/documents',
  '/reports',
  '/settings',
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const pathname = nextUrl.pathname;

  // Protect Admin Routes
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', nextUrl));
    if (role !== 'superadmin') return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Protect Tenant Routes
  if (TENANT_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', nextUrl));
    if (role !== 'tenant') return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Protect Landlord Routes (including property managers, accountants)
  if (LANDLORD_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', nextUrl));
    if (role === 'tenant') return NextResponse.redirect(new URL('/tenant/dashboard', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password|invite).*)'],
};
