import { NextRequest, NextResponse } from 'next/server';
import {
  clearPendingSubmissions,
  getPendingSubmissions,
} from '@/lib/submission-notifications';

export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  return NextResponse.json({ blobIds: getPendingSubmissions(formId) });
}

export async function DELETE(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  clearPendingSubmissions(formId);
  return NextResponse.json({ ok: true });
}
