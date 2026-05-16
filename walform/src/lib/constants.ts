export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '';
export const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID ?? '';
export const SEAL_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_SEAL_THRESHOLD ?? '2');
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as 'mainnet' | 'testnet';
export const SUI_GRPC_URL =
  process.env.NEXT_PUBLIC_SUI_GRPC_URL ??
  (SUI_NETWORK === 'mainnet'
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443');

export const WALRUS_AGGREGATORS = [
  ...(process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ? [process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR] : []),
  ...(SUI_NETWORK === 'mainnet'
    ? ['https://aggregator.walrus.space', 'https://walrus-mainnet-aggregator.staketab.org']
    : [
        'https://aggregator.walrus-testnet.walrus.space',
        'https://wal-aggregator-testnet.staketab.org',
        'https://walrus-testnet-aggregator.bartestnet.com',
        'https://walrus-testnet.blockscope.net',
      ]),
];

export const WALRUS_EPOCHS = 12;
export const WALRUS_UPLOAD_RELAY_HOST =
  process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_HOST ??
  (SUI_NETWORK === 'mainnet'
    ? 'https://upload-relay.mainnet.walrus.space'
    : 'https://upload-relay.testnet.walrus.space');
export const WALRUS_UPLOAD_RELAY_MAX_TIP_MIST =
  process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_MAX_TIP_MIST
    ? parseInt(process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY_MAX_TIP_MIST, 10)
    : Number.NaN;

// Populated after Phase 1 deploy
export const FORM_TYPE_NAME = PACKAGE_ID ? `${PACKAGE_ID}::form::Form` : '';
export const ADMIN_CAP_TYPE_NAME = PACKAGE_ID ? `${PACKAGE_ID}::form::AdminCap` : '';
export const EXPLORER_BASE_URL =
  SUI_NETWORK === 'mainnet' ? 'https://suivision.xyz' : 'https://testnet.suivision.xyz';

export function explorerObjectUrl(objectId: string): string {
  return `${EXPLORER_BASE_URL}/object/${objectId}`;
}

export function walrusBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATORS[0]}/v1/blobs/${blobId}`;
}

export const SEAL_KEY_SERVERS: Array<{ objectId: string; weight: number }> = [
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_1 ?? '', weight: 1 },
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_2 ?? '', weight: 1 },
].filter(s => s.objectId !== '');
