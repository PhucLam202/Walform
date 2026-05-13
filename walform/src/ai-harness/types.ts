import type { Transaction } from '@mysten/sui/transactions';
import type { RouterCompleteTradeRoute } from 'aftermath-ts-sdk';

export const SUI_COIN_TYPE = '0x2::sui::SUI';

export type HarnessNetwork = 'mainnet' | 'testnet';

export type HarnessToolOutput<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface WalletInfoOutput {
  connected: boolean;
  address: string | null;
  network: HarnessNetwork;
}

export interface BalanceOutput {
  coinType: string;
  totalBalance: string;
  symbol: string;
  decimals: number;
  displayAmount: string;
  formatted: string;
}

export interface CoinBalanceSummary {
  coinType: string;
  totalBalance: string;
  symbol: string;
  decimals: number;
  displayAmount: string;
  formatted: string;
}

export interface OwnedObjectSummary {
  objectId: string;
  type: string;
  displayName?: string;
}

export interface TransferSuiProposal {
  kind: 'transfer_sui';
  id: string;
  recipient: string;
  amountMist: string;
  amountSui: string;
  summary: string;
}

export interface TransferSuiRecipient {
  recipient: string;
  amountMist: string;
  amountSui: string;
}

export interface TransferSuiManyProposal {
  kind: 'transfer_sui_many';
  id: string;
  recipients: TransferSuiRecipient[];
  totalAmountMist: string;
  totalAmountSui: string;
  summary: string;
}

export interface TransferObjectProposal {
  kind: 'transfer_object';
  id: string;
  objectId: string;
  recipient: string;
  summary: string;
}

export type BatchTransferItem =
  | { type: 'sui'; amountMist: string; amountSui: string; recipient: string }
  | { type: 'object'; objectId: string; recipient: string };

export interface BatchTransferProposal {
  kind: 'batch_transfer';
  id: string;
  items: BatchTransferItem[];
  recipient: string;
  summary: string;
}

export interface SwapProposal {
  kind: 'swap';
  id: string;
  provider: 'aftermath';
  coinInType: string;
  coinOutType: string;
  amountIn: string;
  expectedAmountOut: string;
  minAmountOut: string;
  slippage: number;
  network: HarnessNetwork;
  route: RouterCompleteTradeRoute;
  summary: string;
}

export type TransactionProposal = TransferSuiProposal | TransferSuiManyProposal | TransferObjectProposal | BatchTransferProposal | SwapProposal;

export interface SwapQuoteInput {
  walletAddress: string;
  network: HarnessNetwork;
  coinInType: string;
  coinOutType: string;
  amountIn: string;
  slippage: number;
}

export interface SwapProvider {
  quote(input: SwapQuoteInput): Promise<SwapProposal>;
  buildTransaction(proposal: SwapProposal, walletAddress: string): Promise<Transaction>;
}
