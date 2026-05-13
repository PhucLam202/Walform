import { WALRUS_PUBLISHERS, WALRUS_AGGREGATORS, WALRUS_EPOCHS } from './constants';
import type { SubmissionBlob, SubmissionIndex } from '@/types/submission';

export interface WalrusUploadResult {
  blobId: string;
  isNew: boolean;
}

// ===== Helpers =====

function getRandomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomPublisher(): string { return getRandomFrom(WALRUS_PUBLISHERS); }
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
    // Handle both camelCase (older publishers) and snake_case (v1.33+ OpenAPI spec)
    const bo = (nc?.blobObject ?? nc?.blob_object) as Record<string, unknown> | undefined;
    const blobId = (bo?.blobId ?? bo?.blob_id) as string | undefined;
    if (blobId) return { blobId, isNew: true };
  }

  if (r?.alreadyCertified) {
    const ac = r.alreadyCertified as Record<string, unknown>;
    // Handle both camelCase and snake_case
    const blobId = (ac?.blobId ?? ac?.blob_id) as string | undefined;
    if (blobId) return { blobId, isNew: false };
  }

  throw new Error('Walrus: no blobId in response — ' + JSON.stringify(result));
}

// ===== Core Upload =====

async function verifyBlob(blobId: string, timeoutMs = 8000): Promise<boolean> {
  for (const agg of WALRUS_AGGREGATORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${agg}/v1/blobs/${blobId}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch { /* try next */ }
  }
  return false;
}

async function uploadToPublisher(
  body: Blob,
  publisher: string,
  timeoutMs = 20_000,
): Promise<WalrusUploadResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${publisher}/v1/blobs?epochs=${WALRUS_EPOCHS}`,
      { method: 'PUT', body, signal: ctrl.signal },
    );
    if (!res.ok) throw new Error(`Walrus upload HTTP ${res.status} from ${publisher}: ${await res.text()}`);
    return parseBlobId(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadBlob(
  data: string | Blob,
  mimeType = 'application/octet-stream',
): Promise<WalrusUploadResult> {
  const body = typeof data === 'string'
    ? new Blob([data], { type: mimeType })
    : data;

  const errors: string[] = [];

  for (const publisher of WALRUS_PUBLISHERS) {
    try {
      // Publisher returns 200 OK only after the blob is certified on-chain — trust it immediately.
      // No aggregator propagation check needed; the blob will be available by the time anyone reads it.
      return await uploadToPublisher(body, publisher);
    } catch (err) {
      errors.push(`${publisher}: ${err}`);
    }
  }

  throw new Error(`Walrus: upload failed on all publishers:\n${errors.join('\n')}`);
}

// Large file upload with XHR progress callback
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
    xhr.open('PUT', `${getRandomPublisher()}/v1/blobs?epochs=${WALRUS_EPOCHS}`);
    xhr.send(file);
  });
  return withRetry(attempt, retries);
}

// ===== Download =====

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
    return null; // 404 / 5xx — try next
  } catch {
    return null; // timeout / network error — try next
  } finally {
    clearTimeout(timer);
  }
}

// Try each aggregator with a timeout; retry once after a brief wait for freshly uploaded blobs.
export async function downloadBlob<T>(blobId: string, timeoutMs = 12_000): Promise<T> {
  // Keep official aggregator first; shuffle the rest so load is distributed
  const [first, ...rest] = WALRUS_AGGREGATORS;
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const aggregators = [first, ...rest];

  // Two passes: immediate, then after 3 s wait (blob may not have propagated yet).
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) await new Promise(r => setTimeout(r, 3000));
    for (const agg of aggregators) {
      const result = await fetchFromAggregator<T>(agg, blobId, timeoutMs);
      if (result !== null) return result;
    }
  }

  throw new Error(`Walrus: blob not found on any aggregator after 2 attempts — blobId=${blobId}`);
}

// ===== JSON Shortcuts =====

export async function uploadJSON<T>(data: T): Promise<WalrusUploadResult> {
  return uploadBlob(JSON.stringify(data), 'application/json');
}

export async function downloadJSON<T>(blobId: string): Promise<T> {
  return downloadBlob<T>(blobId);
}

// ===== Submission-specific =====

export async function uploadSubmissionBlob(blob: SubmissionBlob): Promise<string> {
  const { blobId } = await uploadJSON(blob);
  return blobId;
}

export async function fetchSubmissionIndex(indexBlobId: string): Promise<SubmissionIndex> {
  return downloadJSON<SubmissionIndex>(indexBlobId);
}

// Download current index → append new blobId → upload updated index → return new indexBlobId
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
