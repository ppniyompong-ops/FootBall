import { NextRequest, NextResponse } from 'next/server';
import { apiError, badRequest } from '@/lib/api';
import { adminCookieName, cookieName, createSessionToken } from '@/lib/auth';
import { ensureDatabase, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { name?: string; password?: string };
    if (String(body.password || '') !== (process.env.SHARED_PASSWORD || '1234')) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }
    await ensureDatabase();
    const name = String(body.name || '').trim();
    const { rows } = await pool.query('SELECT id, name, positions FROM players WHERE name = $1', [name]);
    if (!rows[0]) return NextResponse.json({ error: 'ไม่พบชื่อเล่นนี้ในรายชื่อผู้เล่น' }, { status: 401 });
    const response = NextResponse.json({ player: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(adminCookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
    response.cookies.set(cookieName, createSessionToken(Number(rows[0].id)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 14
    });
    return response;
  } catch (error) { return apiError(error); }
}
