'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface FieldOptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

export function FieldOptionsEditor({ options, onChange }: FieldOptionsEditorProps) {
  const [drafts, setDrafts] = useState<string[]>(() =>
    options.length > 0 ? [...options] : [''],
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const selfChange = useRef(false);

  // Sync from parent only when changed externally (e.g. template load)
  useEffect(() => {
    if (selfChange.current) {
      selfChange.current = false;
      return;
    }
    setDrafts(options.length > 0 ? [...options] : ['']);
  }, [options]);

  function commit(next: string[]) {
    const cleaned = next.filter((s) => s.trim() !== '');
    selfChange.current = true;
    onChange(cleaned);
  }

  function update(idx: number, val: string) {
    const next = [...drafts];
    next[idx] = val;
    setDrafts(next);
  }

  function blurCommit(idx: number) {
    const trimmed = drafts[idx].trim();
    const next = [...drafts];
    if (trimmed === '' && next.length > 1) {
      next.splice(idx, 1);
      setDrafts(next);
      commit(next);
    } else {
      next[idx] = trimmed;
      setDrafts(next);
      commit(next);
    }
  }

  function add() {
    const next = [...drafts, ''];
    setDrafts(next);
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 0);
  }

  function remove(idx: number) {
    if (drafts.length === 1) {
      setDrafts(['']);
      selfChange.current = true;
      onChange([]);
      return;
    }
    const next = drafts.filter((_, i) => i !== idx);
    setDrafts(next);
    commit(next);
    setTimeout(() => inputRefs.current[Math.max(0, idx - 1)]?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (drafts[idx].trim() !== '') {
        add();
      }
    } else if (e.key === 'Backspace' && drafts[idx] === '' && drafts.length > 1) {
      e.preventDefault();
      remove(idx);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border p-3" style={{ background: '#f0f9f7', borderColor: '#c8ddd9' }}>
      <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">
        Options
        <span className="ml-1 text-[#aabfc4] font-normal normal-case tracking-normal">
          — Enter to add · Backspace to remove
        </span>
      </Label>

      <div className="space-y-1.5">
        {drafts.map((draft, idx) => (
          <div key={idx} className="flex items-center gap-1.5 group">
            <GripVertical className="size-3.5 shrink-0 text-[#aabfc4] group-hover:text-[#6c8289] transition-colors" />
            <input
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              className="h-8 flex-1 rounded-lg border bg-white px-2.5 text-sm text-[#124741] placeholder:text-[#aabfc4] outline-none transition-colors focus:border-[#91e0da] focus:ring-2 focus:ring-[rgba(145,224,218,0.3)]"
              style={{ borderColor: '#c8ddd9' }}
              value={draft}
              placeholder={`Option ${idx + 1}`}
              onChange={(e) => update(idx, e.target.value)}
              onBlur={() => blurCommit(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => remove(idx)}
              className="shrink-0 rounded-md p-1 text-[#aabfc4] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
              aria-label="Remove option"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#6c8289] hover:text-[#124741] hover:bg-white transition-colors"
      >
        <Plus className="size-3.5" /> Add option
      </button>
    </div>
  );
}
