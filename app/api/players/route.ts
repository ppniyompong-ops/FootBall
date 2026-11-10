import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const viewer = await currentPlayer();
    if (!viewer) return unauthorized();
    const { rows } = await pool.query('SELECT id, name, positions FROM players ORDER BY id');
    return NextResponse.json({ players: rows.filter(item => Number(item.id) !== viewer.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
