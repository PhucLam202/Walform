'use client';

import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { EXPLORER_BASE_URL } from '@/lib/constants';
import type { WalletActivityItem } from '@/types/dashboard';

interface WalletActivityProps {
  items: WalletActivityItem[];
  address?: string;
}

export function WalletActivity({ items, address }: WalletActivityProps) {
  const explorerUrl = address
    ? `${EXPLORER_BASE_URL}/account/${address}`
    : EXPLORER_BASE_URL;
  const visible = items.slice(0, 5);

  return (
    <div className="hub-card p-5" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
          Wallet activity
        </h3>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#6c8289] transition hover:text-[#124741]"
        >
          View all
        </a>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#6c8289]">No recent activity.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: item.positive ? 'rgba(145,224,218,0.18)' : 'rgba(239,68,68,0.08)',
                    color: item.positive ? '#124741' : '#b91c1c',
                  }}
                >
                  {item.positive ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#124741]">{item.title}</p>
                  <p className="text-xs text-[#6c8289]">{item.meta}</p>
                </div>
                <div className="shrink-0 text-right">
                  {item.amount && (
                    <p className="text-sm font-bold" style={{ color: item.positive ? '#124741' : '#b91c1c' }}>
                      {item.amount}
                    </p>
                  )}
                  <p className="text-xs text-[#6c8289]">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>

          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full text-center text-xs font-bold text-[#124741] transition hover:underline"
          >
            View all activity →
          </a>
        </>
      )}
    </div>
  );
}
