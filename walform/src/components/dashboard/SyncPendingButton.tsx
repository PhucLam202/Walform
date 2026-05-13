'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appendToSubmissionIndex } from '@/lib/walrus';
import { buildUpdateSubmissionsIndexTx } from '@/lib/contracts';
import { PACKAGE_ID } from '@/lib/constants';
import type { FormOnChain } from '@/types/form';

interface SyncPendingButtonProps {
  form: FormOnChain;
  adminCapId: string | null;
  onSynced: (newIndexBlobId: string, syncedCount: number) => void;
}

export function SyncPendingButton({ form, adminCapId, onSynced }: SyncPendingButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  async function handleSync() {
    if (!adminCapId) {
      toast.error('Admin cap not found');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/pending-submissions?formId=${form.id}`);
      const { blobIds } = await res.json() as { blobIds: string[] };

      if (!blobIds.length) {
        toast.info('No pending submissions to sync');
        return;
      }

      let indexBlobId = form.submissions_index_blob_id;
      for (const blobId of blobIds) {
        indexBlobId = await appendToSubmissionIndex({
          currentIndexBlobId: indexBlobId,
          newSubmissionBlobId: blobId,
          formId: form.id,
        });
      }

      // Single tx: update index + increment submission_count for each new submission
      const tx = buildUpdateSubmissionsIndexTx({
        formObjectId: form.id,
        adminCapId,
        indexBlobId: indexBlobId!,
      });
      for (let i = 0; i < blobIds.length; i++) {
        tx.moveCall({
          target: `${PACKAGE_ID}::form::record_submission`,
          arguments: [tx.object(form.id), tx.object(adminCapId)],
        });
      }

      const txResult = await signAndExecuteTransaction({ transaction: tx });
      await suiClient.waitForTransaction({ digest: txResult.digest });

      await fetch(`/api/pending-submissions?formId=${form.id}`, { method: 'DELETE' });

      toast.success(`Synced ${blobIds.length} new submission(s)`);
      onSynced(indexBlobId!, blobIds.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Sync failed: ' + msg);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      <RefreshCw className={syncing ? 'size-4 animate-spin' : 'size-4'} />
      {syncing ? 'Syncing…' : 'Sync Pending'}
    </Button>
  );
}
