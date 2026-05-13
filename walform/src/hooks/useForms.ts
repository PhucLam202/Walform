import { useQuery } from '@tanstack/react-query';
import { getFormObject, getOwnedForms } from '@/lib/sui-client';
import { downloadJSON } from '@/lib/walrus';
import type { FormConfig } from '@/types/form';

export function useFormDetail(formId: string | undefined) {
  return useQuery({
    queryKey: ['form', formId],
    queryFn: () => getFormObject(formId!),
    enabled: !!formId,
    staleTime: 30_000,
  });
}

export function useOwnedForms(address: string | undefined) {
  return useQuery({
    queryKey: ['owned-forms', address],
    queryFn: () => getOwnedForms(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}

/** Fetches the FormConfig blob and returns a fieldId→label lookup map */
export function useFormFieldLabels(configBlobId: string | undefined): Record<string, string> {
  const { data } = useQuery<FormConfig>({
    queryKey: ['form-config', configBlobId],
    queryFn: () => downloadJSON<FormConfig>(configBlobId!),
    enabled: !!configBlobId,
    staleTime: Infinity,
  });
  if (!data) return {};
  return Object.fromEntries(data.fields.map((f) => [f.id, f.label]));
}
