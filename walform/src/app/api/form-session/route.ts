import { NextRequest, NextResponse } from 'next/server';
import { generateFormToken } from '@/lib/form-auth';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const formId = (body as Record<string, unknown>)?.formId;
  if (!formId || typeof formId !== 'string' || formId.trim() === '') {
    return NextResponse.json({ error: 'Missing formId' }, { status: 400 });
  }

  try {
    const token = generateFormToken(formId.trim());
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: 'Auth service not configured' }, { status: 503 });
  }
}
