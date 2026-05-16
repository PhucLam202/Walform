import { useQuery, useQueries } from '@tanstack/react-query';
import { fetchSubmissionIndex, downloadJSON } from '@/lib/walrus';
import { SUI_NETWORK } from '@/lib/constants';
import type { SubmissionBlob } from '@/types/submission';
import type { FormOnChain } from '@/types/form';

export function useSubmissionIndex(indexBlobId: string | null | undefined) {
  return useQuery({
    queryKey: ['submission-index', SUI_NETWORK, indexBlobId],
    queryFn: () => fetchSubmissionIndex(indexBlobId!),
    enabled: !!indexBlobId,
    staleTime: 60_000,
  });
}

export function useSubmission(blobId: string | undefined) {
  return useQuery({
    queryKey: ['submission', SUI_NETWORK, blobId],
    queryFn: () => downloadJSON<SubmissionBlob>(blobId!),
    enabled: !!blobId,
    staleTime: Infinity,
  });
}

export interface LoadedSubmission {
  blobId: string;
  blob: SubmissionBlob;
  formTitle: string;
}

export function useAllSubmissions(forms: FormOnChain[]): {
  submissions: LoadedSubmission[];
  isLoading: boolean;
} {
  // Step 1: fetch all submission indices in parallel
  const indexQueries = useQueries({
    queries: forms.map((f) => ({
      queryKey: ['submission-index', SUI_NETWORK, f.id, f.submissions_index_blob_id],
      queryFn: () => fetchSubmissionIndex(f.submissions_index_blob_id!),
      enabled: !!f.submissions_index_blob_id,
      staleTime: 60_000,
    })),
  });

  // Collect (blobId, formTitle) pairs from all loaded indices
  const blobEntries: { blobId: string; formTitle: string }[] = [];
  for (let i = 0; i < forms.length; i++) {
    const idx = indexQueries[i].data;
    if (idx) {
      for (const blobId of idx.blobIds) {
        blobEntries.push({ blobId, formTitle: forms[i].title });
      }
    }
  }

  // Step 2: fetch all blobs in parallel
  const blobQueries = useQueries({
    queries: blobEntries.map(({ blobId }) => ({
      queryKey: ['submission', SUI_NETWORK, blobId],
      queryFn: () => downloadJSON<SubmissionBlob>(blobId),
      enabled: true,
      staleTime: Infinity,
    })),
  });

  const submissions: LoadedSubmission[] = [];
  for (let i = 0; i < blobEntries.length; i++) {
    const blob = blobQueries[i].data;
    if (blob) {
      submissions.push({ blobId: blobEntries[i].blobId, blob, formTitle: blobEntries[i].formTitle });
    }
  }

  const isLoading =
    indexQueries.some((q) => q.isLoading) || blobQueries.some((q) => q.isLoading);

  return { submissions, isLoading };
}
