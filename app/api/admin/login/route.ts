import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, cookieName, createAdminSessionToken } from '@/lib/auth';
import { apiError } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error('ADMIN_PASSWORD is required. Set it in Render environment variables.');
    const body = await request.json().catch(() => ({})) as { password?: string };
    const actualBytes = Buffer.from(String(body.password || ''));
    const expectedBytes = Buffer.from(expected);
    const valid = actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
    if (!valid) return NextResponse.json({ error: 'รหัสผู้ดูแลไม่ถูกต้อง' }, { status: 401 });

    const response = NextResponse.json({ admin: { name: 'ผู้ดูแลระบบ' } }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(adminCookieName, createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 12
    });
    response.cookies.set(cookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
