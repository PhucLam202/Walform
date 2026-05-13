'use client';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io', network: 'testnet' as const },
  mainnet: { url: 'https://fullnode.mainnet.sui.io', network: 'mainnet' as const },
});

const defaultNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as 'mainnet' | 'testnet') ?? 'testnet';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
