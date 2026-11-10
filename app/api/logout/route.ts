import { NextResponse } from 'next/server';
import { adminCookieName, cookieName } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  response.cookies.set(adminCookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
