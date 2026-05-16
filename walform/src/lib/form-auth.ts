import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_SECONDS = 5 * 60;

function getSecret(): string {
  const secret = process.env.PENDING_SUBMISSIONS_SECRET;
  if (!secret) throw new Error('PENDING_SUBMISSIONS_SECRET is not configured');
  return secret;
}

export function generateFormToken(formId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${formId}:${expiry}`;
  const mac = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${mac}`).toString('base64url');
}

export function verifyFormToken(formId: string, rawToken: string): boolean {
  try {
    const decoded = Buffer.from(rawToken, 'base64url').toString('utf8');
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon === -1) return false;
    const payload = decoded.slice(0, lastColon);
    const mac = decoded.slice(lastColon + 1);

    const colonIdx = payload.indexOf(':');
    if (colonIdx === -1) return false;
    const tokenFormId = payload.slice(0, colonIdx);
    const expiryStr = payload.slice(colonIdx + 1);

    if (tokenFormId !== formId) return false;
    const expiry = parseInt(expiryStr, 10);
    if (!Number.isFinite(expiry) || Math.floor(Date.now() / 1000) > expiry) return false;

    const expected = createHmac('sha256', getSecret()).update(payload).digest('hex');
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
