import { SealClient, SessionKey, type SealCompatibleClient } from '@mysten/seal';
import type { Signer } from '@mysten/sui/cryptography';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import {
  PACKAGE_ID,
  SEAL_KEY_SERVERS,
  SEAL_THRESHOLD,
  SUI_GRPC_URL,
  SUI_NETWORK,
} from './constants';
import { getSuiClient } from './sui-client';

export type WalformSealClient = SealClient;

let _suiClient: SealCompatibleClient | null = null;
let _sealClient: SealClient | null = null;

function assertSealConfigured() {
  if (!PACKAGE_ID) throw new Error('Missing NEXT_PUBLIC_PACKAGE_ID');
  if (SEAL_KEY_SERVERS.length < SEAL_THRESHOLD) {
    throw new Error(
      `Seal requires at least ${SEAL_THRESHOLD} key server(s); got ${SEAL_KEY_SERVERS.length}`,
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function objectIdToBytes(objectId: string): number[] {
  return Array.from(fromHex(objectId));
}

export function getSealSuiClient(): SealCompatibleClient {
  if (!_suiClient) _suiClient = new SuiGrpcClient({ network: SUI_NETWORK, baseUrl: SUI_GRPC_URL });
  return _suiClient;
}

export function resetSealClient(): void {
  _sealClient = null;
  _suiClient = null;
}

export function createSealClient(suiClient: SealCompatibleClient = getSealSuiClient()): SealClient {
  assertSealConfigured();
  if (!_sealClient) {
    // verifyKeyServers=false: we use the testnet Seal committee servers cross-network for the hackathon.
    // On-chain object verification would fail because the server objects live on testnet while the app
    // targets mainnet. This is an accepted trade-off documented in .env.production.
    _sealClient = new SealClient({
      suiClient,
      serverConfigs: SEAL_KEY_SERVERS,
      verifyKeyServers: false,
    });
  }
  return _sealClient;
}

export function getSealClient(): SealClient {
  return createSealClient();
}

export async function encryptForForm(params: {
  sealClient?: SealClient;
  formId: string;
  data: string;
}): Promise<{
  encryptedData: string;
  sealRef: string;
}> {
  const sealClient = params.sealClient ?? getSealClient();
  const bytes = new TextEncoder().encode(params.data);

  const { encryptedObject } = await sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: params.formId,
    data: bytes,
  });

  return {
    encryptedData: bytesToBase64(encryptedObject),
    // Seal stores key server metadata inside encryptedObject. Do not persist the returned DEM key.
    sealRef: '',
  };
}

export function buildSealApprovePTB(params: {
  formObjectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::policy::seal_approve`,
    arguments: [
      tx.pure.vector('u8', objectIdToBytes(params.formObjectId)),
      tx.object(params.adminCapId),
    ],
  });
  return tx;
}

export async function createCreatorSessionKey(params: {
  address: string;
  signer?: Signer;
  signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature: string }>;
  suiClient?: SealCompatibleClient;
  packageId?: string;
  ttlMin?: number;
}): Promise<SessionKey> {
  const suiClient = params.suiClient ?? getSealSuiClient();
  const sessionKey = await SessionKey.create({
    address: params.address,
    packageId: params.packageId ?? PACKAGE_ID,
    ttlMin: params.ttlMin ?? 30,
    signer: params.signer,
    suiClient,
  });

  if (!params.signer) {
    if (!params.signPersonalMessage) {
      throw new Error('createCreatorSessionKey requires signer or signPersonalMessage');
    }
    const { signature } = await params.signPersonalMessage(sessionKey.getPersonalMessage());
    await sessionKey.setPersonalMessageSignature(signature);
  }

  return sessionKey;
}

export async function decryptSubmission(params: {
  sealClient?: SealClient;
  sessionKey: SessionKey;
  suiClient?: SealCompatibleClient;
  formId: string;
  adminCapId: string;
  encryptedData: string;
  sealRef?: string;
}): Promise<string> {
  const sealClient = params.sealClient ?? getSealClient();
  const tx = buildSealApprovePTB({
    formObjectId: params.formId,
    adminCapId: params.adminCapId,
  });
  tx.setSenderIfNotSet(params.sessionKey.getAddress());
  // Use HTTP JSON-RPC client for tx.build() — SuiGrpcClient does not fully
  // implement the interface required to resolve object refs and gas coins,
  // which causes BCS serialization failures in the Seal committee validator.
  const txBytes = await tx.build({ client: getSuiClient() as never });

  const decrypted = await sealClient.decrypt({
    data: base64ToBytes(params.encryptedData),
    sessionKey: params.sessionKey,
    txBytes,
  });

  return new TextDecoder().decode(decrypted);
}
