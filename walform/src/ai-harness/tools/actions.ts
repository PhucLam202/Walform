import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress, isValidSuiObjectId, normalizeSuiAddress, normalizeSuiObjectId } from '@mysten/sui/utils';

import { SUI_COIN_TYPE, type BatchTransferItem, type BatchTransferProposal, type TransferObjectProposal, type TransferSuiManyProposal, type TransferSuiProposal } from '../types';

const MIST_PER_SUI = BigInt(1_000_000_000);
const ZERO = BigInt(0);

function makeProposalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatMistAsSui(mist: string | bigint) {
  const value = BigInt(mist);
  const whole = value / MIST_PER_SUI;
  const fraction = (value % MIST_PER_SUI).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function parseSuiToMist(amount: string | number) {
  const raw = String(amount).trim();
  if (!/^\d+(\.\d{1,9})?$/.test(raw)) {
    throw new Error('Amount must be a positive SUI number with up to 9 decimals.');
  }

  const [whole, fraction = ''] = raw.split('.');
  const mist = BigInt(whole) * MIST_PER_SUI + BigInt(fraction.padEnd(9, '0'));
  if (mist <= ZERO) throw new Error('Amount must be greater than 0.');
  return mist.toString();
}

export function createTransferSuiProposal(input: {
  recipient: string;
  amountSui: string | number;
  availableMist?: string;
}): TransferSuiProposal {
  if (!isValidSuiAddress(input.recipient)) {
    throw new Error('Recipient is not a valid Sui address.');
  }

  const amountMist = parseSuiToMist(input.amountSui);
  if (input.availableMist && BigInt(amountMist) >= BigInt(input.availableMist)) {
    throw new Error('Amount is too high. Keep some SUI for gas.');
  }

  const recipient = normalizeSuiAddress(input.recipient);
  const amountSui = formatMistAsSui(amountMist);

  return {
    kind: 'transfer_sui',
    id: makeProposalId('transfer'),
    recipient,
    amountMist,
    amountSui,
    summary: `Transfer ${amountSui} SUI to ${recipient}`,
  };
}

export function buildTransferSuiTx(proposal: TransferSuiProposal) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(proposal.amountMist)]);
  tx.transferObjects([coin], proposal.recipient);
  return tx;
}

export function createTransferSuiManyProposal(input: {
  recipients: Array<{ recipient: string; amountSui: string | number }>;
  availableMist?: string;
}): TransferSuiManyProposal {
  if (input.recipients.length < 2) {
    throw new Error('Use multi-recipient transfer with at least 2 recipients.');
  }

  const recipients = input.recipients.map((item) => {
    if (!isValidSuiAddress(item.recipient)) {
      throw new Error(`Recipient is not a valid Sui address: ${item.recipient}`);
    }

    const amountMist = parseSuiToMist(item.amountSui);
    return {
      recipient: normalizeSuiAddress(item.recipient),
      amountMist,
      amountSui: formatMistAsSui(amountMist),
    };
  });

  const totalAmountMist = recipients.reduce((sum, item) => sum + BigInt(item.amountMist), ZERO);
  if (input.availableMist && totalAmountMist >= BigInt(input.availableMist)) {
    throw new Error('Total amount is too high. Keep some SUI for gas.');
  }

  return {
    kind: 'transfer_sui_many',
    id: makeProposalId('transfer_many'),
    recipients,
    totalAmountMist: totalAmountMist.toString(),
    totalAmountSui: formatMistAsSui(totalAmountMist),
    summary: `Transfer ${formatMistAsSui(totalAmountMist)} SUI to ${recipients.length} recipients`,
  };
}

export function buildTransferSuiManyTx(proposal: TransferSuiManyProposal) {
  const tx = new Transaction();
  const coins = tx.splitCoins(
    tx.gas,
    proposal.recipients.map((recipient) => tx.pure.u64(recipient.amountMist)),
  );

  proposal.recipients.forEach((recipient, index) => {
    tx.transferObjects([coins[index]], recipient.recipient);
  });

  return tx;
}

export function createTransferObjectProposal(input: {
  objectId: string;
  recipient: string;
}): TransferObjectProposal {
  if (!isValidSuiObjectId(input.objectId)) {
    throw new Error('Object ID is not a valid Sui object ID.');
  }

  if (!isValidSuiAddress(input.recipient)) {
    throw new Error('Recipient is not a valid Sui address.');
  }

  const objectId = normalizeSuiObjectId(input.objectId);
  const recipient = normalizeSuiAddress(input.recipient);

  return {
    kind: 'transfer_object',
    id: makeProposalId('transfer_object'),
    objectId,
    recipient,
    summary: `Transfer object ${objectId} to ${recipient}`,
  };
}

export function buildTransferObjectTx(proposal: TransferObjectProposal) {
  const tx = new Transaction();
  tx.transferObjects([tx.object(proposal.objectId)], proposal.recipient);
  return tx;
}

export function isSuiTransferCoinType(coinType: string) {
  return coinType === SUI_COIN_TYPE;
}

export function createBatchTransferProposal(input: {
  recipient: string;
  amountSui?: string | number;
  objectIds?: string[];
  availableMist?: string;
}): BatchTransferProposal {
  if (!isValidSuiAddress(input.recipient)) {
    throw new Error('Recipient is not a valid Sui address.');
  }

  const recipient = normalizeSuiAddress(input.recipient);
  const items: BatchTransferItem[] = [];
  const parts: string[] = [];

  if (input.amountSui != null) {
    const amountMist = parseSuiToMist(input.amountSui);
    if (input.availableMist && BigInt(amountMist) >= BigInt(input.availableMist)) {
      throw new Error('Amount is too high. Keep some SUI for gas.');
    }
    const amountSui = formatMistAsSui(amountMist);
    items.push({ type: 'sui', amountMist, amountSui, recipient });
    parts.push(`${amountSui} SUI`);
  }

  for (const objectId of input.objectIds ?? []) {
    if (!isValidSuiObjectId(objectId)) {
      throw new Error(`Object ID is not a valid Sui object ID: ${objectId}`);
    }
    const normalized = normalizeSuiObjectId(objectId);
    items.push({ type: 'object', objectId: normalized, recipient });
    parts.push(`object ${normalized.slice(0, 10)}…`);
  }

  if (items.length === 0) {
    throw new Error('Provide at least one SUI amount or object ID to transfer.');
  }

  return {
    kind: 'batch_transfer',
    id: makeProposalId('batch_transfer'),
    items,
    recipient,
    summary: `Transfer ${parts.join(', ')} to ${recipient}`,
  };
}

export function buildBatchTransferTx(proposal: BatchTransferProposal) {
  const tx = new Transaction();

  // Collect all transfer arguments in one array for a single transferObjects call
  const transferArgs: { $kind: string }[] = [];

  const suiItems = proposal.items.filter((item): item is Extract<BatchTransferItem, { type: 'sui' }> => item.type === 'sui');
  const objectItems = proposal.items.filter((item): item is Extract<BatchTransferItem, { type: 'object' }> => item.type === 'object');

  if (suiItems.length > 0) {
    const splitResults = tx.splitCoins(
      tx.gas,
      suiItems.map((item) => tx.pure.u64(item.amountMist)),
    );
    // splitCoins returns a TransactionArgument array when given an array
    if (Array.isArray(splitResults)) {
      for (const coin of splitResults) transferArgs.push(coin as { $kind: string });
    } else {
      // single element returned as tuple-like result
      suiItems.forEach((_, i) => transferArgs.push((splitResults as unknown as { $kind: string }[])[i]));
    }
  }

  for (const item of objectItems) {
    transferArgs.push(tx.object(item.objectId) as { $kind: string });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx.transferObjects(transferArgs as any[], proposal.recipient);

  return tx;
}
