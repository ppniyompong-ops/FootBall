import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { apiError, unauthorized } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = await currentAdmin();
    if (!admin) return unauthorized();
    return NextResponse.json({ admin }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
