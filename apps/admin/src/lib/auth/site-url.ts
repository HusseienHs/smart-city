import 'server-only';

import { headers } from 'next/headers';

/**
 * The dashboard's own origin, for links in emails (password reset).
 *
 * Production requires ADMIN_SITE_URL: a Host header is client-controlled, and an email link
 * must never point at an address an attacker chose. (Supabase additionally only sends links
 * to allow-listed redirect URLs.) Development falls back to the request's own address.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.ADMIN_SITE_URL;
  if (configured) return new URL(configured).origin;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SITE_URL must be set in production (see apps/admin/.env.example).');
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
