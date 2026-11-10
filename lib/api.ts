import { NextResponse } from 'next/server';

export function unauthorized() {
  return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export function apiError(error: unknown) {
  console.error(error);
  const detail = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (detail.includes('DATABASE_URL')) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า DATABASE_URL ใน Render' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (detail.includes('APP_SECRET')) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า APP_SECRET ใน Render' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '28P01'].includes(code)) {
    return NextResponse.json({ error: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ ตรวจสอบ DATABASE_URL และสิทธิ์การเชื่อมต่อใน Render' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}
