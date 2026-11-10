import { NextResponse } from 'next/server';

export function unauthorized() {
  return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export function apiError(error: unknown) {
  console.error(error);
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}
