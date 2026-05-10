'use client';

import {
  AUTH_EVENTS,
  getUser,
  handleAuthCallback,
  login as netlifyLogin,
  logout as netlifyLogout,
  onAuthChange,
  signup as netlifySignup,
  updateUser as netlifyUpdateUser,
  type User,
} from '@netlify/identity';

export type IdentityUser = User;

export async function initializeIdentity() {
  await handleAuthCallback();
}

export async function getCurrentIdentityUser() {
  return getUser();
}

export async function login(email: string, password: string) {
  return netlifyLogin(email, password);
}

export async function signup(email: string, password: string, fullName?: string) {
  return netlifySignup(email, password, fullName ? { full_name: fullName } : undefined);
}

export async function updatePassword(password: string) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated.');
  return netlifyUpdateUser({ password });
}

export async function logout() {
  await netlifyLogout();
}

export function onLogin(callback: (user: IdentityUser) => void) {
  return onAuthChange((event, user) => {
    if (event === AUTH_EVENTS.LOGIN && user) callback(user);
  });
}

export function onLogout(callback: () => void) {
  return onAuthChange((event) => {
    if (event === AUTH_EVENTS.LOGOUT) callback();
  });
}

export async function requestPasswordReset(email: string) {
  const response = await fetch('/.netlify/identity/recover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) throw new Error('Password reset request failed.');
}
