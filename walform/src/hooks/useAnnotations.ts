'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useCallback } from 'react';
import type { SessionKey } from '@mysten/seal';
import { useFormDetail } from './useForms';
import {
  encryptForForm,
  decryptSubmission,
  getSealClient,
  getSealSuiClient,
} from '@/lib/seal';
import { uploadJSON, downloadBlob } from '@/lib/walrus';
import { buildUpdateAnnotationsBlobTx } from '@/lib/contracts';
import type {
  SubmissionAnnotation,
  SubmissionStatus,
  SubmissionPriority,
  AnnotationsBlob,
} from '@/types/submission';

export function useAnnotations(
  formId: string,
  adminCapId: string | null,
  sessionKey: SessionKey | null,
) {
  const queryClient = useQueryClient();
  const { data: form } = useFormDetail(formId);
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const { data: annotations = {} } = useQuery<Record<string, SubmissionAnnotation>>({
    queryKey: ['annotations', formId],
    queryFn: async () => {
      if (!form?.annotations_blob_id || !adminCapId || !sessionKey) return {};
      const raw = await downloadBlob<{ encrypted: string }>(form.annotations_blob_id);
      const plaintext = await decryptSubmission({
        sealClient: getSealClient(),
        sessionKey,
        suiClient: getSealSuiClient(),
        formId,
        adminCapId,
        encryptedData: raw.encrypted,
      });
      const parsed: AnnotationsBlob = JSON.parse(plaintext);
      return parsed.annotations;
    },
    enabled: !!form && !!adminCapId && !!sessionKey,
    staleTime: 60_000,
  });

  const getAnnotation = useCallback(
    (blobId: string): SubmissionAnnotation =>
      annotations[blobId] ?? { status: 'new', priority: 'medium', note: '', updatedAt: 0 },
    [annotations],
  );

  const saveMutation = useMutation({
    mutationFn: async (updated: Record<string, SubmissionAnnotation>) => {
      if (!adminCapId || !form) throw new Error('No adminCap or form');
      const blob: AnnotationsBlob = {
        formId,
        version: 1,
        annotations: updated,
        updatedAt: Date.now(),
      };
      const { encryptedData } = await encryptForForm({
        formId,
        data: JSON.stringify(blob),
      });
      const { blobId } = await uploadJSON({ encrypted: encryptedData });
      const tx = buildUpdateAnnotationsBlobTx({
        formObjectId: form.id,
        adminCapId,
        blobId,
      });
      await signAndExecuteTransaction({ transaction: tx });
      return updated;
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ['annotations', formId] });
      const previous = queryClient.getQueryData<Record<string, SubmissionAnnotation>>(['annotations', formId]);
      queryClient.setQueryData(['annotations', formId], updated);
      return previous;
    },
    onError: (_err, _vars, previous) => {
      if (previous !== undefined) {
        queryClient.setQueryData(['annotations', formId], previous);
      }
    },
  });

  const setStatus = useCallback(
    (blobId: string, status: SubmissionStatus) => {
      const current = { ...annotations };
      current[blobId] = {
        ...(current[blobId] ?? { priority: 'medium', note: '', updatedAt: 0 }),
        status,
        updatedAt: Date.now(),
      };
      saveMutation.mutate(current);
    },
    [annotations, saveMutation],
  );

  const setNote = useCallback(
    (blobId: string, note: string) => {
      const current = { ...annotations };
      current[blobId] = {
        ...(current[blobId] ?? { status: 'new', priority: 'medium', updatedAt: 0 }),
        note,
        updatedAt: Date.now(),
      };
      saveMutation.mutate(current);
    },
    [annotations, saveMutation],
  );

  const setPriority = useCallback(
    (blobId: string, priority: SubmissionPriority) => {
      const current = { ...annotations };
      current[blobId] = {
        ...(current[blobId] ?? { status: 'new', note: '', updatedAt: 0 }),
        priority,
        updatedAt: Date.now(),
      };
      saveMutation.mutate(current);
    },
    [annotations, saveMutation],
  );

  return { getAnnotation, setStatus, setNote, setPriority, isSaving: saveMutation.isPending };
}
