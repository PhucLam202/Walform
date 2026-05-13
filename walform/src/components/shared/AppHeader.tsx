'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { Wallet } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
  showWalletConnect?: boolean;
  sticky?: boolean;
  className?: string;
  containerClassName?: string;
}

export function AppHeader({
  rightSlot,
  showWalletConnect = false,
  sticky = true,
  className,
  containerClassName,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex min-h-[70px] w-full items-center justify-between gap-6 px-6 py-3',
          containerClassName ?? 'max-w-[1280px]',
        )}
      > 
        <BrandLogo />

        {rightSlot ? (
          <div className="flex items-center gap-3">{rightSlot}</div>
        ) : showWalletConnect ? (
          <div className="[&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-[18px] [&_button]:border [&_button]:border-slate-200 [&_button]:bg-white [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-bold [&_button]:text-slate-800 [&_button]:shadow-sm [&_button]:transition-colors [&_button]:hover:border-violet-200 [&_button]:hover:bg-violet-50 [&_button]:hover:text-violet-700">
            <ConnectButton
              connectText={
                <span className="inline-flex items-center gap-2">
                  <Wallet className="size-4" />
                  Connect Wallet
                </span>
              }
            />
          </div>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}
