import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ensureDatabase, pool } from '@/lib/db';

export const cookieName = 'football_session';
export const adminCookieName = 'football_admin_session';

function getAppSecret() {
  const secret = process.env.APP_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-change-me');
  if (!secret) throw new Error('APP_SECRET is required in production.');
  return secret;
}

export interface Player {
  id: number;
  name: string;
  positions: string;
}

function signSession(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getAppSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySession(token: string): Record<string, unknown> | null {
  const [encoded, givenSignature] = token.split('.');
  if (!encoded || !givenSignature) return null;
  const expected = createHmac('sha256', getAppSecret()).update(encoded).digest();
  const actual = Buffer.from(givenSignature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (!payload.exp || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function createSessionToken(playerId: number) {
  return signSession({ playerId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 });
}

export function createAdminSessionToken() {
  return signSession({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
}

function verifyPlayerSession(token: string): number | null {
  const payload = verifySession(token);
  if (!payload || payload.role || !Number.isInteger(payload.playerId)) return null;
  return payload.playerId as number;
}

function verifyAdminSession(token: string) {
  return verifySession(token)?.role === 'admin';
}

export async function currentPlayer(): Promise<Player | null> {
  await ensureDatabase();
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  const playerId = verifyPlayerSession(token);
  if (!playerId) return null;
  const { rows } = await pool.query('SELECT id, name, positions FROM players WHERE id = $1', [playerId]);
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), name: String(rows[0].name), positions: String(rows[0].positions) };
}

export async function currentAdmin(): Promise<{ name: string } | null> {
  const store = await cookies();
  const token = store.get(adminCookieName)?.value;
  if (!token || !verifyAdminSession(token)) return null;
  return { name: 'ผู้ดูแลระบบ' };
}
