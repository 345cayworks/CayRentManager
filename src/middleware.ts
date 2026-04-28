import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROUTES = ['/admin'];
const TENANT_ROUTES = ['/tenant'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const role = request.headers.get('x-rentflow-role');

  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route)) && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (TENANT_ROUTES.some((route) => pathname.startsWith(route)) && role !== 'tenant' && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/tenant/:path*'],
};
