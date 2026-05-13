import { Transaction } from '@mysten/sui/transactions';
import type { SuiTransactionBlockResponse, SuiObjectChangeCreated } from '@mysten/sui/jsonRpc';
import { PACKAGE_ID } from './constants';

const encoder = new TextEncoder();

function blobIdToBytes(blobId: string): number[] {
  return Array.from(encoder.encode(blobId));
}

// ===== TX Builders =====

export function buildCreateFormTx(params: {
  title: string;
  description: string;
  formType: string;
  configBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::create_form`,
    arguments: [
      tx.pure.string(params.title),
      tx.pure.string(params.description),
      tx.pure.string(params.formType),
      tx.pure.vector('u8', blobIdToBytes(params.configBlobId)),
      tx.object('0x6'), // Sui Clock singleton
    ],
  });
  return tx;
}

export function buildToggleActiveTx(params: {
  formObjectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::toggle_active`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
    ],
  });
  return tx;
}

export function buildUpdateConfigTx(params: {
  formObjectId: string;
  adminCapId: string;
  newBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::update_config_blob`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.vector('u8', blobIdToBytes(params.newBlobId)),
    ],
  });
  return tx;
}

export function buildUpdateSubmissionsIndexTx(params: {
  formObjectId: string;
  adminCapId: string;
  indexBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::update_submissions_index`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.vector('u8', blobIdToBytes(params.indexBlobId)),
      tx.object('0x6'), // Sui Clock singleton
    ],
  });
  return tx;
}

export function buildUpdateAnnotationsBlobTx(params: {
  formObjectId: string;
  adminCapId: string;
  blobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::update_annotations_blob`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.vector('u8', blobIdToBytes(params.blobId)),
    ],
  });
  return tx;
}

export function buildGrantAdminTx(params: {
  formObjectId: string;
  adminCapId: string;
  adminAddress: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::grant_admin`,
    arguments: [
      tx.object(params.formObjectId),
      tx.object(params.adminCapId),
      tx.pure.address(params.adminAddress),
    ],
  });
  return tx;
}

export function buildRecordSubmissionTx(params: {
  formObjectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::form::record_submission`,
    arguments: [tx.object(params.formObjectId)],
  });
  return tx;
}

// ===== Result Parsers =====

export interface CreatedFormResult {
  formId: string;
  adminCapId: string;
}

// Parse the two objects created by create_form.
// Uses objectType from showObjectChanges to distinguish Form vs AdminCap.
export function extractFormAndCap(
  response: SuiTransactionBlockResponse,
  packageId = PACKAGE_ID,
): CreatedFormResult {
  const changes = response.objectChanges ?? [];

  const created = changes.filter(
    (c): c is SuiObjectChangeCreated => c.type === 'created',
  );

  const formChange = created.find(c =>
    c.objectType === `${packageId}::form::Form`,
  );
  const capChange = created.find(c =>
    c.objectType === `${packageId}::form::AdminCap`,
  );

  if (!formChange || !capChange) {
    // Fallback: use effects.created order (Form first, AdminCap second per Move source)
    const effCreated = response.effects?.created ?? [];
    if (effCreated.length < 2) {
      throw new Error(
        `Expected 2 created objects (Form + AdminCap), got ${effCreated.length}`,
      );
    }
    return {
      formId: effCreated[0].reference.objectId,
      adminCapId: effCreated[1].reference.objectId,
    };
  }

  return { formId: formChange.objectId, adminCapId: capChange.objectId };
}
