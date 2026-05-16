import { useQuery } from '@tanstack/react-query';
import { getRecentTransactions } from '@/lib/sui-client';
import { SUI_NETWORK } from '@/lib/constants';
import type { WalletActivityItem } from '@/types/dashboard';

function formatTime(ms: number): string {
  if (!ms) return 'Unknown';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function useWalletActivity(address: string | undefined) {
  return useQuery({
    queryKey: ['wallet-activity', SUI_NETWORK, address],
    queryFn: async (): Promise<WalletActivityItem[]> => {
      const txs = await getRecentTransactions(address!, 20);
      return txs.map((tx) => ({
        id: tx.digest,
        title: 'On-chain transaction',
        meta: `${tx.digest.slice(0, 8)}…${tx.digest.slice(-6)}`,
        time: formatTime(tx.timestampMs),
        positive: true,
      }));
    },
    enabled: !!address,
    staleTime: 60_000,
  });
}
