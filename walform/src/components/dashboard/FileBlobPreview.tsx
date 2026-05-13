'use client';

import { useState } from 'react';
import { getRandomAggregator } from '@/lib/walrus';

interface FileBlobPreviewProps {
  blobId: string;
  mimeType: string;
  fileName: string;
}

export function FileBlobPreview({ blobId, mimeType, fileName }: FileBlobPreviewProps) {
  const [revealed, setRevealed] = useState(false);
  const url = `${getRandomAggregator()}/v1/blobs/${blobId}`;

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="text-xs text-blue-600 underline hover:text-blue-800"
      >
        View {fileName}
      </button>
    );
  }

  if (mimeType.startsWith('image/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={fileName} className="max-h-64 rounded-xl border border-slate-200" />
    );
  }
  if (mimeType.startsWith('video/')) {
    return (
      <video src={url} controls className="max-h-64 w-full rounded-xl" />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 underline hover:text-blue-800"
    >
      Download {fileName} ↗
    </a>
  );
}
