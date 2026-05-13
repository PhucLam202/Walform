'use client';

import Link from 'next/link';
import { Bell, LayoutDashboard, Inbox } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit';
import { BrandLogo } from '@/components/shared/BrandLogo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Submissions', icon: Inbox },
];

export function DashboardHeader() {
  return (
    <header
      className="hub-glass-header sticky top-0 z-50 mx-4 mt-3 rounded-[18px]"
      style={{ height: 58 }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-5">
        {/* Brand */}
        <BrandLogo />

        {/* Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="hub-font-ui flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-700 text-[#124741] transition hover:bg-[#eef8f4] hover:text-[#0d302c]"
              style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}
            >
              <Icon className="size-4 opacity-70" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right slot */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(108,130,137,0.18)] bg-white/80 text-[#6c8289] transition hover:bg-[#eef8f4] hover:text-[#124741]"
          >
            <Bell className="size-4" />
          </button>

          <div
            className="[&_button]:inline-flex [&_button]:items-center [&_button]:gap-2
              [&_button]:rounded-[14px] [&_button]:border [&_button]:border-[rgba(145,224,218,0.45)]
              [&_button]:bg-[#124741] [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm
              [&_button]:font-bold [&_button]:text-white [&_button]:shadow-sm
              [&_button]:transition [&_button]:hover:bg-[#0d302c]"
          >
            <ConnectButton connectText="Connect Wallet" />
          </div>
        </div>
      </div>
    </header>
  );
}
