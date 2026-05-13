'use client';

import { useState, useCallback, useRef } from 'react';
import { useSignPersonalMessage, useCurrentAccount } from '@mysten/dapp-kit';
import {
  createCreatorSessionKey,
  decryptSubmission,
  getSealClient,
  getSealSuiClient,
} from '@/lib/seal';
import type { SessionKey } from '@mysten/seal';

export function useDecrypt() {
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const account = useCurrentAccount();
  const [decrypting, setDecrypting] = useState(false);
  const sessionKeyRef = useRef<SessionKey | null>(null);

  const getOrCreateSessionKey = useCallback(async (): Promise<SessionKey> => {
    if (sessionKeyRef.current) return sessionKeyRef.current;
    if (!account?.address) throw new Error('Wallet not connected');

    const key = await createCreatorSessionKey({
      address: account.address,
      signPersonalMessage: async (msg: Uint8Array) => {
        const result = await signPersonalMessage({ message: msg });
        return { signature: result.signature };
      },
      suiClient: getSealSuiClient(),
    });

    sessionKeyRef.current = key;
    return key;
  }, [account, signPersonalMessage]);

  const decrypt = useCallback(
    async (params: {
      formId: string;
      adminCapId: string;
      encryptedData: string;
    }): Promise<string> => {
      setDecrypting(true);
      try {
        const sk = await getOrCreateSessionKey();
        return await decryptSubmission({
          sealClient: getSealClient(),
          sessionKey: sk,
          suiClient: getSealSuiClient(),
          ...params,
        });
      } finally {
        setDecrypting(false);
      }
    },
    [getOrCreateSessionKey],
  );

  const resetSessionKey = useCallback(() => {
    sessionKeyRef.current = null;
  }, []);

  const getSessionKey = useCallback(() => sessionKeyRef.current, []);

  return { decrypt, decrypting, resetSessionKey, getSessionKey };
}
