import {
  SuiJsonRpcClient as SuiClient,
  getJsonRpcFullnodeUrl as getFullnodeUrl,
} from '@mysten/sui/jsonRpc';
import { SUI_NETWORK, FORM_TYPE_NAME, ADMIN_CAP_TYPE_NAME } from './constants';
import type { FormOnChain } from '@/types/form';

const decoder = new TextDecoder();

// ===== Singleton client =====

let _client: SuiClient | null = null;

export function getSuiClient(): SuiClient {
  if (!_client) _client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK), network: SUI_NETWORK });
  return _client;
}

// ===== Parsing =====

function bytesToString(bytes: number[] | null | undefined): string {
  if (!bytes || bytes.length === 0) return '';
  return decoder.decode(new Uint8Array(bytes));
}

function asByteArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.every((v) => typeof v === 'number')) return value as number[];
  if (value.every((v) => typeof v === 'string' && /^\d+$/.test(v))) {
    return (value as string[]).map((v) => Number(v));
  }
  return null;
}

function decodeBlobId(value: unknown): string {
  if (typeof value === 'string') return value;
  const bytes = asByteArray(value);
  if (bytes) return bytesToString(bytes);
  return '';
}

function decodeOptionalBlobId(value: unknown): string | null {
  if (value == null) return null;

  // Older/newer RPCs may return Option<T> as { vec: [] | [T] }
  if (typeof value === 'object' && !Array.isArray(value) && 'vec' in value) {
    const vec = (value as { vec?: unknown[] }).vec;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    const decoded = decodeBlobId(vec[0]);
    return decoded || null;
  }

  // Some RPC responses flatten Option<vector<u8>> directly as vector<u8> | null
  const decoded = decodeBlobId(value);
  return decoded || null;
}

function parseFormObject(raw: unknown): FormOnChain {
  const obj = raw as {
    data?: {
      objectId?: string;
      content?: {
        fields?: Record<string, unknown>;
      };
    };
  };

  const data = obj?.data;
  const fields = data?.content?.fields as Record<string, unknown> | undefined;
  if (!fields || !data?.objectId) throw new Error('Invalid Form object structure');

  return {
    id: data.objectId,
    owner: fields.owner as string,
    title: fields.title as string,
    description: fields.description as string,
    form_type: fields.form_type as string,
    version: Number(fields.version ?? 0),
    config_blob_id: decodeBlobId(fields.config_blob_id),
    submissions_index_blob_id: decodeOptionalBlobId(fields.submissions_index_blob_id),
    annotations_blob_id: decodeOptionalBlobId(fields.annotations_blob_id),
    last_index_updated: Number(fields.last_index_updated ?? 0),
    is_active: fields.is_active as boolean,
    submission_count: Number(fields.submission_count ?? 0),
    created_at: Number(fields.created_at ?? 0),
  };
}

// ===== Queries =====

export async function getFormObject(formId: string): Promise<FormOnChain> {
  const client = getSuiClient();
  const raw = await client.getObject({
    id: formId,
    options: { showContent: true, showOwner: true },
  });
  return parseFormObject(raw);
}

export async function getOwnedForms(address: string): Promise<FormOnChain[]> {
  if (!FORM_TYPE_NAME) return []; // packageId not set yet
  const client = getSuiClient();
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: FORM_TYPE_NAME },
    options: { showContent: true, showOwner: true },
  });
  return data
    .map((item: unknown) => {
      try { return parseFormObject(item); }
      catch { return null; }
    })
    .filter((f): f is FormOnChain => f !== null);
}

// Returns objectId of the AdminCap whose form_id matches the given formId, or null
export async function getAdminCap(
  address: string,
  formId: string,
): Promise<string | null> {
  if (!ADMIN_CAP_TYPE_NAME) return null;
  const client = getSuiClient();
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: ADMIN_CAP_TYPE_NAME },
    options: { showContent: true },
  });

  for (const obj of data) {
    const fields = (obj.data?.content as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (fields?.form_id === formId) {
      return obj.data?.objectId ?? null;
    }
  }
  return null;
}

export interface RecentTransaction {
  digest: string;
  timestampMs: number;
  kind: string;
}

export async function getRecentTransactions(address: string, limit = 20): Promise<RecentTransaction[]> {
  const client = getSuiClient();
  const { data } = await client.queryTransactionBlocks({
    filter: { FromAddress: address },
    options: { showInput: true },
    limit,
    order: 'descending',
  });

  return data.map((tx) => {
    const ts = tx.timestampMs ? Number(tx.timestampMs) : 0;
    const kind = (tx.transaction?.data?.transaction as { kind?: string } | undefined)?.kind ?? 'ProgrammableTransaction';
    return { digest: tx.digest, timestampMs: ts, kind };
  });
}

// Convenience: fetch all AdminCaps owned by address
export async function getAllAdminCaps(
  address: string,
): Promise<Array<{ objectId: string; formId: string }>> {
  if (!ADMIN_CAP_TYPE_NAME) return [];
  const client = getSuiClient();
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: ADMIN_CAP_TYPE_NAME },
    options: { showContent: true },
  });

  return data
    .map((obj: unknown) => {
      const o = obj as { data?: { objectId?: string; content?: { fields?: Record<string, unknown> } } };
      const fields = o.data?.content?.fields;
      const objectId = o.data?.objectId;
      const formId = fields?.form_id as string | undefined;
      if (!objectId || !formId) return null;
      return { objectId, formId };
    })
    .filter((c): c is { objectId: string; formId: string } => c !== null);
}
