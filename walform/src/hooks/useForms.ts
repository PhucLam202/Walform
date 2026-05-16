import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFormObject, getOwnedForms } from '@/lib/sui-client';
import { downloadJSON } from '@/lib/walrus';
import { PACKAGE_ID, SUI_NETWORK } from '@/lib/constants';
import type { FormConfig } from '@/types/form';

const chainScope = [SUI_NETWORK, PACKAGE_ID] as const;

export function useFormDetail(formId: string | undefined) {
  return useQuery({
    queryKey: ['form', ...chainScope, formId],
    queryFn: () => getFormObject(formId!),
    enabled: !!formId,
    staleTime: 30_000,
  });
}

export function useOwnedForms(address: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['owned-forms', ...chainScope, address],
    queryFn: () => getOwnedForms(address!),
    enabled: enabled && !!address,
    staleTime: 30_000,
  });
}

/** Fetches the FormConfig blob and returns a fieldId→label lookup map */
export function useFormFieldLabels(configBlobId: string | undefined): Record<string, string> {
  const { data } = useQuery<FormConfig>({
    queryKey: ['form-config', SUI_NETWORK, configBlobId],
    queryFn: () => downloadJSON<FormConfig>(configBlobId!),
    enabled: !!configBlobId,
    staleTime: Infinity,
  });
  return useMemo(
    () => (data ? Object.fromEntries(data.fields.map((f) => [f.id, f.label])) : {}),
    [data],
  );
}
