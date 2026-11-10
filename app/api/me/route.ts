import { NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';
import { getActiveRound } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const player = await currentPlayer();
    if (!player) return unauthorized();
    return NextResponse.json({ player, round: await getActiveRound() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
