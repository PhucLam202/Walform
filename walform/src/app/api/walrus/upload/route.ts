import { NextResponse } from 'next/server';
import { walrus } from '@mysten/walrus';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import {
  SUI_GRPC_URL,
  SUI_NETWORK,
  WALRUS_EPOCHS,
  WALRUS_UPLOAD_RELAY_HOST,
  WALRUS_UPLOAD_RELAY_MAX_TIP_MIST,
} from '@/lib/constants';

function createWalrusClient() {
  return new SuiGrpcClient({
    network: SUI_NETWORK,
    baseUrl: SUI_GRPC_URL,
  }).$extend(
    walrus({
      uploadRelay: {
        host: WALRUS_UPLOAD_RELAY_HOST,
        sendTip: Number.isFinite(WALRUS_UPLOAD_RELAY_MAX_TIP_MIST)
          ? { max: WALRUS_UPLOAD_RELAY_MAX_TIP_MIST }
          : undefined,
      },
    }),
  );
}

let _client: ReturnType<typeof createWalrusClient> | null = null;

function getWalrusClient() {
  if (!_client) {
    _client = createWalrusClient();
  }
  return _client;
}

function getServerSigner() {
  const secret = process.env.WALRUS_SUI_PRIVATE_KEY;
  if (!secret) {
    throw new Error('missing_private_key: WALRUS_SUI_PRIVATE_KEY is required');
  }

  const decoded = decodeSuiPrivateKey(secret);
  switch (decoded.scheme) {
    case 'ED25519':
      return Ed25519Keypair.fromSecretKey(decoded.secretKey);
    case 'Secp256k1':
      return Secp256k1Keypair.fromSecretKey(decoded.secretKey);
    case 'Secp256r1':
      return Secp256r1Keypair.fromSecretKey(decoded.secretKey);
    default:
      throw new Error(`unsupported_private_key_scheme: ${decoded.scheme}`);
  }
}

function classifyUploadError(message: string): { status: number; code: string } {
  const normalized = message.toLowerCase();

  if (normalized.includes('missing_private_key')) {
    return { status: 500, code: 'missing_private_key' };
  }
  // bech32 key-format errors: env var is set but contains an invalid/placeholder value
  if (
    normalized.includes('letter') ||
    normalized.includes('bech32') ||
    normalized.includes('invalid character') ||
    normalized.includes('must be present between prefix') ||
    normalized.includes('unsupported_private_key_scheme')
  ) {
    return { status: 500, code: 'invalid_private_key' };
  }
  if (normalized.includes('tip') && normalized.includes('max')) {
    return { status: 502, code: 'relay_tip_exceeds_max' };
  }
  if (
    normalized.includes('insufficient') ||
    normalized.includes('balance') ||
    normalized.includes('no valid gas coins') ||
    normalized.includes('gas')
  ) {
    return { status: 402, code: 'insufficient_sui_or_wal' };
  }
  if (
    normalized.includes('fetch failed') ||
    normalized.includes('timeout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound')
  ) {
    return { status: 503, code: 'relay_unreachable' };
  }

  return { status: 502, code: 'walrus_upload_failed' };
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength !== null) {
      const declared = parseInt(contentLength, 10);
      if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'File too large', code: 'file_too_large' },
          { status: 413 },
        );
      }
    }

    const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
    const bytes = new Uint8Array(await req.arrayBuffer());

    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File too large', code: 'file_too_large' },
        { status: 413 },
      );
    }
    const client = getWalrusClient();
    const signer = getServerSigner();

    const result = await client.walrus.writeBlob({
      blob: bytes,
      deletable: false,
      epochs: WALRUS_EPOCHS,
      signer,
    });

    return NextResponse.json({
      newlyCreated: {
        blobObject: {
          blobId: result.blobId,
        },
      },
      contentType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { status, code } = classifyUploadError(message);
    console.error('[walrus/upload] error', { code, message });
    const clientMessage: Record<string, string> = {
      missing_private_key: 'Server configuration error',
      invalid_private_key: 'Server configuration error',
      relay_tip_exceeds_max: 'Upload relay configuration error',
      insufficient_sui_or_wal: 'Insufficient gas or WAL funds',
      relay_unreachable: 'Upload service temporarily unavailable',
      file_too_large: 'File too large',
      walrus_upload_failed: 'Upload failed',
    };
    return NextResponse.json(
      { error: clientMessage[code] ?? 'Upload failed', code },
      { status },
    );
  }
}
