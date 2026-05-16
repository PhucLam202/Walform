'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useOwnedForms } from '@/hooks/useForms';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardHomeHub } from '@/components/dashboard/DashboardHomeHub';
import { WalletGuard } from '@/components/shared/WalletGuard';
import { AppFooter } from '@/components/shared/AppFooter';
import { SUI_NETWORK } from '@/lib/constants';

function DashboardContent() {
  const account = useCurrentAccount();
  const walletNetwork = account?.chains?.[0]?.startsWith('sui:')
    ? account.chains[0].slice(4)
    : undefined;
  const isCorrectNetwork = !walletNetwork || walletNetwork === SUI_NETWORK;
  const { data: forms, isLoading } = useOwnedForms(account?.address, isCorrectNetwork);

  return (
    <WalletGuard>
      {!isCorrectNetwork && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          Wallet is connected to {walletNetwork}, but WalForm is configured for {SUI_NETWORK}.
          Switch wallet network before viewing or signing forms.
        </div>
      )}
      <DashboardHomeHub forms={forms ?? []} isLoading={isLoading} address={isCorrectNetwork ? account?.address : undefined} />
    </WalletGuard>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f4fcf7' }}>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">
        <DashboardContent />
      </main>
      <AppFooter />
    </div>
  );
}
