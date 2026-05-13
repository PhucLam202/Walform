'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useOwnedForms } from '@/hooks/useForms';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardHomeHub } from '@/components/dashboard/DashboardHomeHub';
import { WalletGuard } from '@/components/shared/WalletGuard';
import { AppFooter } from '@/components/shared/AppFooter';

function DashboardContent() {
  const account = useCurrentAccount();
  const { data: forms, isLoading } = useOwnedForms(account?.address);

  return (
    <WalletGuard>
      <DashboardHomeHub forms={forms ?? []} isLoading={isLoading} address={account?.address} />
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
