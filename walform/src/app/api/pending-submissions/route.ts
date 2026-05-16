import { NextRequest, NextResponse } from 'next/server';
import {
  clearPendingSubmissions,
  getPendingSubmissions,
} from '@/lib/submission-notifications';
import { verifyFormToken } from '@/lib/form-auth';

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  const token = extractBearer(req);
  if (!token || !verifyFormToken(formId, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ blobIds: getPendingSubmissions(formId) });
}

export async function DELETE(req: NextRequest) {
  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'Missing formId' }, { status: 400 });

  const token = extractBearer(req);
  if (!token || !verifyFormToken(formId, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  clearPendingSubmissions(formId);
  return NextResponse.json({ ok: true });
}
