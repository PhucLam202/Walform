'use client';

import { useBuilderStore } from '@/store/builder';
import { TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_META } from '@/lib/templates';
import { toast } from 'sonner';

export function TemplatePicker() {
  const loadTemplate = useBuilderStore((s) => s.loadTemplate);

  function handleLoad(key: string) {
    const tmpl = TEMPLATES[key];
    if (!tmpl) return;
    loadTemplate(tmpl);
    toast.success(`Template "${TEMPLATE_META[key]?.label ?? key}" loaded`);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--hub-muted)]">
        Templates
      </p>

      {TEMPLATE_CATEGORIES.map((cat) => (
        <div key={cat.label} className="space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--hub-muted)] opacity-70">
            <span>{cat.icon}</span>
            {cat.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {cat.keys.map((key) => {
              const meta = TEMPLATE_META[key];
              if (!meta) return null;
              return (
                <button
                  key={key}
                  onClick={() => handleLoad(key)}
                  className="group w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--hub-surface-soft)]"
                >
                  <span className="block text-xs font-semibold text-[var(--hub-primary)] group-hover:text-[var(--hub-accent)] transition">
                    {meta.label}
                  </span>
                  <span className="block text-[10px] text-[var(--hub-muted)] leading-tight">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
