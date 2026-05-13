import { cn } from '@/lib/utils';

interface AppFooterProps {
  className?: string;
  text?: string;
  children?: React.ReactNode;
}

export function AppFooter({
  className,
  text = 'WalForm · Decentralized form platform powered by Walrus, Seal, and Sui.',
  children,
}: AppFooterProps) {
  return (
    <footer
      className={cn('border-t', className)}
      style={{ borderColor: 'var(--hub-border)', background: 'rgba(244,252,247,0.9)', fontFamily: 'var(--font-ui)' }}
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-6 py-5 text-center text-xs text-[#6c8289] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>{text}</p>
        {children ? <div>{children}</div> : null}
      </div>
    </footer>
  );
}
