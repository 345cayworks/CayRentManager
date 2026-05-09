import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

const COOKIE_NAME = 'crm_app_session';
const SESSION_DAYS = 14;

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET;
}

function sign(token: string) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('APP_SESSION_SECRET is required for app sessions.');
  return crypto.createHmac('sha256', secret).update(token).digest('base64url');
}

function hash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookie(value?: string) {
  if (!value) return null;
  const [token, signature] = value.split('.');
  if (!token || !signature) return null;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(token)))) return null;
  } catch {
    return null;
  }

  return token;
}

export async function createAppSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.appSession.create({
    data: {
      userId,
      tokenHash: hash(token),
      expiresAt,
    },
  });

  cookies().set(COOKIE_NAME, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearAppSession() {
  const token = parseCookie(cookies().get(COOKIE_NAME)?.value);
  if (token) {
    await prisma.appSession.deleteMany({ where: { tokenHash: hash(token) } });
  }
  cookies().delete(COOKIE_NAME);
}

export async function getAppSessionUser() {
  const token = parseCookie(cookies().get(COOKIE_NAME)?.value);
  if (!token) return null;

  const session = await prisma.appSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.appSession.delete({ where: { id: session.id } });
    cookies().delete(COOKIE_NAME);
    return null;
  }

  return session.user;
}
