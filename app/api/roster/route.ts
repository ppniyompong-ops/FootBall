import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { ensureDatabase, pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureDatabase();
    const { rows } = await pool.query('SELECT id, name, positions FROM players ORDER BY id');
    return NextResponse.json({ players: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
