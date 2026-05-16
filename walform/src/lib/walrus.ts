import { WALRUS_AGGREGATORS } from './constants';
import type { SubmissionBlob, SubmissionIndex } from '@/types/submission';

export interface WalrusUploadResult {
  blobId: string;
  isNew: boolean;
}

function getRandomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomAggregator(): string { return getRandomFrom(WALRUS_AGGREGATORS); }

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw new Error('unreachable');
}

function parseBlobId(result: unknown): WalrusUploadResult {
  const r = result as Record<string, unknown>;

  if (r?.newlyCreated) {
    const nc = r.newlyCreated as Record<string, unknown>;
    const bo = (nc?.blobObject ?? nc?.blob_object) as Record<string, unknown> | undefined;
    const blobId = (bo?.blobId ?? bo?.blob_id) as string | undefined;
    if (blobId) return { blobId, isNew: true };
  }

  if (r?.alreadyCertified) {
    const ac = r.alreadyCertified as Record<string, unknown>;
    const blobId = (ac?.blobId ?? ac?.blob_id) as string | undefined;
    if (blobId) return { blobId, isNew: false };
  }

  throw new Error('Walrus: no blobId in response — ' + JSON.stringify(result));
}

export async function uploadBlob(
  data: string | Blob,
  mimeType = 'application/octet-stream',
): Promise<WalrusUploadResult> {
  const body = typeof data === 'string'
    ? new Blob([data], { type: mimeType })
    : data;

  const res = await fetch('/api/walrus/upload', {
    method: 'POST',
    headers: { 'Content-Type': body.type || mimeType },
    body,
  });
  if (!res.ok) {
    throw new Error(`Walrus relay upload HTTP ${res.status}: ${await res.text()}`);
  }
  return parseBlobId(await res.json());
}

export function uploadLargeFile(
  file: File,
  onProgress?: (pct: number) => void,
  retries = 3,
): Promise<WalrusUploadResult> {
  const attempt = () => new Promise<WalrusUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Walrus large file HTTP ${xhr.status}`));
        return;
      }
      try { resolve(parseBlobId(JSON.parse(xhr.responseText))); }
      catch (e) { reject(e); }
    };
    xhr.onerror = () => reject(new Error('Walrus large file network error'));
    xhr.open('POST', '/api/walrus/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
  return withRetry(attempt, retries);
}

async function fetchFromAggregator<T>(
  agg: string,
  blobId: string,
  timeoutMs: number,
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${agg}/v1/blobs/${blobId}`, { signal: ctrl.signal });
    if (res.ok) return res.json() as Promise<T>;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadBlob<T>(blobId: string, timeoutMs = 12_000): Promise<T> {
  const [first, ...rest] = WALRUS_AGGREGATORS;
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const aggregators = [first, ...rest];

  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) await new Promise(r => setTimeout(r, 3000));
    for (const agg of aggregators) {
      const result = await fetchFromAggregator<T>(agg, blobId, timeoutMs);
      if (result !== null) return result;
    }
  }

  throw new Error(`Walrus: blob not found on any aggregator after 2 attempts — blobId=${blobId}`);
}

export async function uploadJSON<T>(data: T): Promise<WalrusUploadResult> {
  return uploadBlob(JSON.stringify(data), 'application/json');
}

export async function downloadJSON<T>(blobId: string): Promise<T> {
  return downloadBlob<T>(blobId);
}

export async function uploadSubmissionBlob(blob: SubmissionBlob): Promise<string> {
  const { blobId } = await uploadJSON(blob);
  return blobId;
}

export async function fetchSubmissionIndex(indexBlobId: string): Promise<SubmissionIndex> {
  return downloadJSON<SubmissionIndex>(indexBlobId);
}

export async function appendToSubmissionIndex(params: {
  currentIndexBlobId: string | null;
  newSubmissionBlobId: string;
  formId: string;
}): Promise<string> {
  let index: SubmissionIndex;

  if (params.currentIndexBlobId) {
    index = await fetchSubmissionIndex(params.currentIndexBlobId);
    index.blobIds.push(params.newSubmissionBlobId);
    index.version += 1;
    index.updatedAt = Date.now();
  } else {
    index = {
      formId: params.formId,
      version: 1,
      blobIds: [params.newSubmissionBlobId],
      updatedAt: Date.now(),
    };
  }

  const { blobId } = await uploadJSON(index);
  return blobId;
}
