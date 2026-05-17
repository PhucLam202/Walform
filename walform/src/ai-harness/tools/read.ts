import type { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';

import { getAllAdminCaps, getOwnedForms, getRecentTransactions } from '@/lib/sui-client';
import { downloadJSON, fetchSubmissionIndex } from '@/lib/walrus';
import type { FormOnChain } from '@/types/form';
import type { SubmissionBlob } from '@/types/submission';
import {
  SUI_COIN_TYPE,
  type CoinBalanceSummary,
  type HarnessNetwork,
  type HarnessToolOutput,
  type OwnedObjectSummary,
  type WalletInfoOutput,
} from '../types';

type FormMatch =
  | { match: 'none'; candidates: [] }
  | { match: 'single'; form: FormOnChain; candidates: FormOnChain[] }
  | { match: 'multiple'; candidates: FormOnChain[] };

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

function sortFormsByCreatedAt(forms: FormOnChain[]) {
  return [...forms].sort((a, b) => b.created_at - a.created_at);
}

function isObjectId(value: string) {
  return /^0x[0-9a-fA-F]{40,}$/.test(value.trim());
}

function normalizeReference(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toFormSummary(form: FormOnChain) {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    form_type: form.form_type,
    created_at: form.created_at,
    createdAtIso: form.created_at ? new Date(form.created_at).toISOString() : null,
    is_active: form.is_active,
    submission_count: form.submission_count,
    submissions_index_blob_id: form.submissions_index_blob_id,
  };
}

function resolveOwnedForm(forms: FormOnChain[], reference?: string | null, activeFormId?: string | null): FormMatch {
  const value = reference?.trim();

  if (!value && activeFormId) {
    const form = forms.find((item) => item.id === activeFormId);
    return form ? { match: 'single', form, candidates: [form] } : { match: 'none', candidates: [] };
  }

  if (!value) {
    const latest = sortFormsByCreatedAt(forms)[0];
    return latest ? { match: 'single', form: latest, candidates: [latest] } : { match: 'none', candidates: [] };
  }

  if (isObjectId(value)) {
    const form = forms.find((item) => item.id.toLowerCase() === value.toLowerCase());
    return form ? { match: 'single', form, candidates: [form] } : { match: 'none', candidates: [] };
  }

  const normalized = normalizeReference(value);
  const exact = forms.filter((item) => normalizeReference(item.title) === normalized);
  if (exact.length === 1) return { match: 'single', form: exact[0], candidates: exact };
  if (exact.length > 1) return { match: 'multiple', candidates: sortFormsByCreatedAt(exact) };

  const contains = forms.filter((item) => normalizeReference(item.title).includes(normalized));
  if (contains.length === 1) return { match: 'single', form: contains[0], candidates: contains };
  if (contains.length > 1) return { match: 'multiple', candidates: sortFormsByCreatedAt(contains) };

  return { match: 'none', candidates: [] };
}

async function getLatestSubmissionForForm(form: FormOnChain) {
  if (!form.submissions_index_blob_id) return null;

  try {
    const index = await fetchSubmissionIndex(form.submissions_index_blob_id);
    const latestBlobIds = [...index.blobIds].reverse().slice(0, 5);
    const submissions = await Promise.all(
      latestBlobIds.map(async (blobId) => {
        try {
          const blob = await downloadJSON<SubmissionBlob>(blobId);
          return { blobId, blob };
        } catch {
          return null;
        }
      }),
    );
    const latest = submissions
      .filter((item): item is { blobId: string; blob: SubmissionBlob } => item !== null)
      .sort((a, b) => b.blob.submittedAt - a.blob.submittedAt)[0];

    if (!latest) return null;

    return {
      formId: form.id,
      formTitle: form.title,
      blobId: latest.blobId,
      submittedAt: latest.blob.submittedAt,
      fieldCount: Object.keys(latest.blob.plainFields ?? {}).length,
      hasEncryptedFields: Boolean(latest.blob.encryptedFields),
      fileCount: Object.keys(latest.blob.fileBlobs ?? {}).length,
    };
  } catch {
    return null;
  }
}

export async function getWalFormPortfolio(address?: string | null) {
  if (!address) return { ok: false, error: 'Connect a wallet first.' } as const;

  const [forms, adminCaps, recentTransactions] = await Promise.all([
    getOwnedForms(address),
    getAllAdminCaps(address),
    getRecentTransactions(address, 8),
  ]);
  const formsByCreatedAt = sortFormsByCreatedAt(forms);
  const adminCapsByForm = adminCaps.map((cap) => {
    const form = forms.find((item) => item.id === cap.formId);
    return {
      ...cap,
      formTitle: form?.title ?? null,
    };
  });
  const latestReceivedSubmission = (await Promise.all(
    forms.map((form) => getLatestSubmissionForForm(form)),
  ))
    .filter((item): item is NonNullable<Awaited<ReturnType<typeof getLatestSubmissionForForm>>> => item !== null)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0] ?? null;

  return {
    ok: true,
    data: {
      forms,
      formsByCreatedAt,
      adminCaps: adminCapsByForm,
      recentTransactions,
      summary: {
        formsCount: forms.length,
        adminCapsCount: adminCaps.length,
        recentTransactionsCount: recentTransactions.length,
        latestOwnedForm: formsByCreatedAt[0] ?? null,
        latestReceivedSubmission,
        latestRecentTransaction: recentTransactions[0] ?? null,
        respondentSubmissionTrackingAvailable: false,
        note: 'WalForm respondent submissions do not require a wallet, so this wallet portfolio cannot prove which external forms the connected wallet personally submitted. It can answer owned forms and latest submissions received by owned forms.',
      },
    },
  } as const;
}

export async function getWalFormFormStats(params: {
  address?: string | null;
  formReference?: string | null;
  activeFormId?: string | null;
}) {
  if (!params.address) return { ok: false, error: 'Connect a wallet first.' } as const;

  const forms = await getOwnedForms(params.address);
  const resolved = resolveOwnedForm(forms, params.formReference, params.activeFormId);

  if (resolved.match === 'none') {
    return {
      ok: true,
      data: {
        match: 'none' as const,
        query: params.formReference ?? null,
        walletAddress: params.address,
        formsCount: forms.length,
        candidates: sortFormsByCreatedAt(forms).slice(0, 5).map(toFormSummary),
        message: forms.length
          ? 'No owned form matched this reference. Ask the user to choose one of the candidate forms or provide a form ID.'
          : 'This connected wallet does not own any WalForm forms.',
      },
    } as const;
  }

  if (resolved.match === 'multiple') {
    return {
      ok: true,
      data: {
        match: 'multiple' as const,
        query: params.formReference ?? null,
        walletAddress: params.address,
        candidates: resolved.candidates.slice(0, 8).map(toFormSummary),
        message: 'Multiple owned forms matched this reference. Ask the user to choose by title, created time, or form ID before answering.',
      },
    } as const;
  }

  const latestReceivedSubmission = await getLatestSubmissionForForm(resolved.form);
  let walrusSubmissionCount = 0;
  let submissionIndexUpdatedAt: number | null = null;

  if (resolved.form.submissions_index_blob_id) {
    try {
      const index = await fetchSubmissionIndex(resolved.form.submissions_index_blob_id);
      walrusSubmissionCount = index.blobIds.length;
      submissionIndexUpdatedAt = index.updatedAt;
    } catch {
      walrusSubmissionCount = 0;
    }
  }

  return {
    ok: true,
    data: {
      match: 'single' as const,
      walletAddress: params.address,
      form: toFormSummary(resolved.form),
      stats: {
        onChainSubmissionCount: resolved.form.submission_count,
        walrusSubmissionCount,
        bestKnownSubmissionCount: Math.max(resolved.form.submission_count, walrusSubmissionCount),
        submissionIndexUpdatedAt,
        submissionIndexUpdatedAtIso: submissionIndexUpdatedAt ? new Date(submissionIndexUpdatedAt).toISOString() : null,
        latestReceivedSubmission,
      },
    },
  } as const;
}
