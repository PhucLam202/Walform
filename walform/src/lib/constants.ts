export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '';
export const SEAL_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID ?? '';
export const SEAL_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_SEAL_THRESHOLD ?? '2');
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as 'mainnet' | 'testnet';
export const SUI_GRPC_URL =
  process.env.NEXT_PUBLIC_SUI_GRPC_URL ??
  (SUI_NETWORK === 'mainnet'
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443');

// Official publisher first — most reliable for certification
export const WALRUS_PUBLISHERS = [
  'https://publisher.walrus-testnet.walrus.space',
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ?? 'https://walrus-testnet-publisher-1.staketab.org:443',
  'https://walrus-testnet-publisher.bartestnet.com',
];

export const WALRUS_AGGREGATORS = [
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space',
  'https://wal-aggregator-testnet.staketab.org',
  'https://walrus-testnet-aggregator.bartestnet.com',
  'https://walrus-testnet.blockscope.net',
];

export const WALRUS_EPOCHS = 12;

// Populated after Phase 1 deploy
export const FORM_TYPE_NAME = PACKAGE_ID ? `${PACKAGE_ID}::form::Form` : '';
export const ADMIN_CAP_TYPE_NAME = PACKAGE_ID ? `${PACKAGE_ID}::form::AdminCap` : '';

export const SEAL_KEY_SERVERS: Array<{ objectId: string; weight: number }> = [
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_1 ?? '', weight: 1 },
  { objectId: process.env.NEXT_PUBLIC_SEAL_SERVER_2 ?? '', weight: 1 },
].filter(s => s.objectId !== '');
