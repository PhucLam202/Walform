const RATE_LIMIT_COUNT = 10;
const RATE_LIMIT_WINDOW_SEC = 3600;

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

type NotificationStore = {
  pending: Map<string, string[]>;
  rateLimits: Map<string, RateLimitEntry>;
};

const globalStore = globalThis as typeof globalThis & {
  __walformNotificationStore?: NotificationStore;
};

const store = globalStore.__walformNotificationStore ??= {
  pending: new Map<string, string[]>(),
  rateLimits: new Map<string, RateLimitEntry>(),
};

export function checkSubmissionNotifyRateLimit(formId: string, ip: string): boolean {
  const now = Date.now();
  const key = `${formId}:${ip}`;
  const existing = store.rateLimits.get(key);

  if (!existing || existing.expiresAt <= now) {
    store.rateLimits.set(key, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_SEC * 1000,
    });
    return true;
  }

  existing.count += 1;
  return existing.count <= RATE_LIMIT_COUNT;
}

export function addPendingSubmission(formId: string, submissionBlobId: string) {
  const current = store.pending.get(formId) ?? [];
  if (current.includes(submissionBlobId)) return false;
  store.pending.set(formId, [submissionBlobId, ...current]);
  return true;
}

export function getPendingSubmissions(formId: string): string[] {
  const current = store.pending.get(formId) ?? [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const blobId of current) {
    if (seen.has(blobId)) continue;
    seen.add(blobId);
    unique.push(blobId);
  }
  if (unique.length !== current.length) {
    store.pending.set(formId, unique);
  }
  return unique;
}

export function clearPendingSubmissions(formId: string) {
  store.pending.delete(formId);
}
