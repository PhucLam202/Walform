import type { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';

import { getAllAdminCaps, getOwnedForms, getRecentTransactions } from '@/lib/sui-client';
import {
  SUI_COIN_TYPE,
  type CoinBalanceSummary,
  type HarnessNetwork,
  type HarnessToolOutput,
  type OwnedObjectSummary,
  type WalletInfoOutput,
} from '../types';

function symbolFromCoinType(coinType: string) {
  return coinType.split('::').at(-1) || 'TOKEN';
}

function fallbackDecimalsForCoinType(coinType: string) {
  const symbol = symbolFromCoinType(coinType).toUpperCase();
  if (coinType === SUI_COIN_TYPE || symbol === 'WAL') return 9;
  return 0;
}

function formatDecimalAmount(raw: string, decimals: number, maxFractionDigits = 4) {
  const normalizedDecimals = Number.isFinite(decimals) && decimals > 0 ? Math.floor(decimals) : 0;
  const value = BigInt(raw);

  if (normalizedDecimals === 0) {
    return new Intl.NumberFormat('en-US').format(Number(value));
  }

  const scale = BigInt(10) ** BigInt(normalizedDecimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(normalizedDecimals, '0');
  const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  const wholeFormatted = new Intl.NumberFormat('en-US').format(Number(whole));

  if (whole === BigInt(0) && !trimmedFraction && value > BigInt(0)) {
    return `<0.${'0'.repeat(Math.max(maxFractionDigits - 1, 0))}1`;
  }

  return trimmedFraction ? `${wholeFormatted}.${trimmedFraction}` : wholeFormatted;
}

async function getCoinDisplayInfo(client: SuiClient, coinType: string) {
  const metadata = await client.getCoinMetadata({ coinType }).catch(() => null);
  return {
    symbol: metadata?.symbol || symbolFromCoinType(coinType),
    decimals: typeof metadata?.decimals === 'number'
      ? metadata.decimals
      : fallbackDecimalsForCoinType(coinType),
  };
}

export function getWalletInfo(params: {
  address?: string | null;
  network: HarnessNetwork;
}): HarnessToolOutput<WalletInfoOutput> {
  return {
    ok: true,
    data: {
      connected: Boolean(params.address),
      address: params.address ?? null,
      network: params.network,
    },
  };
}

export async function getSuiBalance(params: {
  client: SuiClient;
  address?: string | null;
  coinType?: string;
}) {
  if (!params.address) return { ok: false, error: 'Connect a wallet first.' } as const;

  const coinType = params.coinType || SUI_COIN_TYPE;
  const balance = await params.client.getBalance({ owner: params.address, coinType });
  const display = await getCoinDisplayInfo(params.client, coinType);
  const displayAmount = formatDecimalAmount(balance.totalBalance, display.decimals);

  return {
    ok: true,
    data: {
      coinType,
      totalBalance: balance.totalBalance,
      symbol: display.symbol,
      decimals: display.decimals,
      displayAmount,
      formatted: `${displayAmount} ${display.symbol}`,
    },
  } as const;
}

async function formatCoinBalance(
  client: SuiClient,
  coinType: string,
  totalBalance: string,
): Promise<CoinBalanceSummary> {
  const display = await getCoinDisplayInfo(client, coinType);
  const displayAmount = formatDecimalAmount(totalBalance, display.decimals);

  return {
    coinType,
    totalBalance,
    symbol: display.symbol,
    decimals: display.decimals,
    displayAmount,
    formatted: `${displayAmount} ${display.symbol}`,
  };
}

export async function getCoinBalances(params: {
  client: SuiClient;
  address?: string | null;
}): Promise<HarnessToolOutput<CoinBalanceSummary[]>> {
  if (!params.address) return { ok: false, error: 'Connect a wallet first.' };

  const balances = await params.client.getAllBalances({ owner: params.address });
  return {
    ok: true,
    data: await Promise.all(
      balances.map((balance) => formatCoinBalance(params.client, balance.coinType, balance.totalBalance)),
    ),
  };
}

export async function getOwnedObjectSummaries(params: {
  client: SuiClient;
  address?: string | null;
  limit?: number;
}): Promise<HarnessToolOutput<OwnedObjectSummary[]>> {
  if (!params.address) return { ok: false, error: 'Connect a wallet first.' };

  const { data } = await params.client.getOwnedObjects({
    owner: params.address,
    limit: params.limit ?? 20,
    options: { showType: true, showDisplay: true },
  });

  return {
    ok: true,
    data: data.map((item) => ({
      objectId: item.data?.objectId ?? '',
      type: item.data?.type ?? 'unknown',
      displayName: typeof item.data?.display?.data?.name === 'string'
        ? item.data.display.data.name
        : undefined,
    })).filter((item) => item.objectId),
  };
}

export async function getWalFormPortfolio(address?: string | null) {
  if (!address) return { ok: false, error: 'Connect a wallet first.' } as const;

  const [forms, adminCaps, recentTransactions] = await Promise.all([
    getOwnedForms(address),
    getAllAdminCaps(address),
    getRecentTransactions(address, 8),
  ]);

  return {
    ok: true,
    data: {
      forms,
      adminCaps,
      recentTransactions,
    },
  } as const;
}
