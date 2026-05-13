import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  href?: string | null;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
}

export function BrandLogo({
  href = '/',
  className,
  markClassName,
  textClassName,
  showWordmark = true,
}: BrandLogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span
        className={cn(
          'relative grid size-11 place-items-center',
          markClassName,
        )}
        aria-hidden="true"
      >
        <Image
          src="/logo-icon.svg"
          alt=""
          width={48}
          height={48}
          className="relative z-10 size-[70%] object-contain"
          priority
        />
      </span>
      {showWordmark && (
        <span className={cn('flex flex-col leading-none', textClassName)}>
          <span className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-slate-400">
            Secure Forms
          </span>
          <span className="mt-1 text-xl font-black tracking-[-0.06em] text-slate-950">WalForm</span>
        </span>
      )}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center" aria-label="WalForm home">
      {content}
    </Link>
  );
}
