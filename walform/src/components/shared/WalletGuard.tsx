'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { EmptyState } from './EmptyState';
import { Wallet } from 'lucide-react';

interface WalletGuardProps {
  children: React.ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <EmptyState
          icon={<Wallet className="size-10 text-muted-foreground" />}
          title="Connect your wallet"
          description="Please connect your Sui wallet to continue."
        />
      </div>
    );
  }

  return <>{children}</>;
}
