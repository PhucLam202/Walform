import { NextRequest, NextResponse } from 'next/server';
import {
  addPendingSubmission,
  checkSubmissionNotifyRateLimit,
} from '@/lib/submission-notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formId, submissionBlobId } = body as {
      formId?: string;
      submissionBlobId?: string;
    };

    if (!formId || !submissionBlobId) {
      return NextResponse.json(
        { error: 'Missing formId or submissionBlobId' },
        { status: 400 },
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkSubmissionNotifyRateLimit(formId, ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const added = addPendingSubmission(formId, submissionBlobId);
    return NextResponse.json({ ok: true, added });
  } catch (err) {
    console.error('[notify-submission]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
