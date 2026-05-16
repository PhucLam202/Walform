'use client';

import Link from 'next/link';
import { Plus, LayoutTemplate, ChevronRight } from 'lucide-react';

const ACTIONS = [
  {
    href: '/builder',
    icon: Plus,
    label: 'Create a new form',
    description: 'Build a form in minutes with our easy-to-use builder.',
    iconBg: '#124741',
  },
  {
    href: '/builder',
    icon: LayoutTemplate,
    label: 'Browse templates',
    description: 'Start from a template and customize to your needs.',
    iconBg: '#eef8f4',
    iconColor: '#124741',
  },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" style={{ fontFamily: 'var(--font-ui)' }}>
      {ACTIONS.map(({ href, icon: Icon, label, description, iconBg, iconColor }) => (
        <Link
          key={label}
          href={href}
          className="hub-card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition group-hover:scale-105"
            style={{ background: iconBg, color: iconColor ?? 'white' }}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#124741]" style={{ fontWeight: 800 }}>{label}</p>
            <p className="mt-0.5 text-xs leading-5 text-[#6c8289]">{description}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-[#6c8289] transition group-hover:text-[#124741]" />
        </Link>
      ))}
    </div>
  );
}
