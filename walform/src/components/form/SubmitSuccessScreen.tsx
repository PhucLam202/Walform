'use client';

import { CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

const AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space';

interface SubmitSuccessScreenProps {
  formTitle: string;
  submissionBlobId?: string;
}

export function SubmitSuccessScreen({ formTitle, submissionBlobId }: SubmitSuccessScreenProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!submissionBlobId) return;
    await navigator.clipboard.writeText(submissionBlobId);
    setCopied(true);
    toast.success('Blob ID copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <CheckCircle2 className="size-16 text-green-500" />

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Response Submitted!</h2>
        <p className="text-muted-foreground max-w-sm">
          Your response to <strong>{formTitle}</strong> has been encrypted and stored on Walrus.
        </p>
      </div>

      {submissionBlobId && (
        <div className="w-full max-w-lg space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Submission stored on Walrus
          </p>

          {/* Blob ID + copy */}
          <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2">
            <code className="flex-1 truncate text-xs font-mono text-foreground">
              {submissionBlobId}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy Blob ID"
            >
              {copied
                ? <Check className="size-4 text-green-600" />
                : <Copy className="size-4" />
              }
            </button>
          </div>

          {/* Verify link */}
          <a
            href={`${AGGREGATOR}/v1/${submissionBlobId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
          >
            <ExternalLink className="size-3" />
            Verify on Walrus Aggregator ↗
          </a>

          <p className="text-xs text-muted-foreground">
            Save this Blob ID — it is your proof of submission on the decentralized network.
          </p>
        </div>
      )}

      <Button variant="outline" render={<Link href="/" />}>
        Back to Home
      </Button>
    </div>
  );
}
