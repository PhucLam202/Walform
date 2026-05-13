'use client';

import {
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  Circle,
  Star,
  Link,
  Mail,
  Paperclip,
  GitBranch,
  Phone,
  Hash,
  Calendar,
  Wallet,
} from 'lucide-react';
import { useBuilderStore } from '@/store/builder';
import { FieldTypeButton } from './FieldTypeButton';
import type { FieldType } from '@/types/form';

const BASIC_TYPES: Array<{ type: FieldType; label: string; icon: React.ReactNode }> = [
  { type: 'text',     label: 'Text',      icon: <Type className="size-4" /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft className="size-4" /> },
  { type: 'email',    label: 'Email',     icon: <Mail className="size-4" /> },
  { type: 'number',   label: 'Number',    icon: <Hash className="size-4" /> },
  { type: 'date',     label: 'Date',      icon: <Calendar className="size-4" /> },
  { type: 'phone',    label: 'Phone',     icon: <Phone className="size-4" /> },
];

const CHOICE_TYPES: Array<{ type: FieldType; label: string; icon: React.ReactNode }> = [
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown className="size-4" /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="size-4" /> },
  { type: 'radio',    label: 'Radio',    icon: <Circle className="size-4" /> },
  { type: 'rating',   label: 'Rating',   icon: <Star className="size-4" /> },
];

const LINK_TYPES: Array<{ type: FieldType; label: string; icon: React.ReactNode }> = [
  { type: 'url',    label: 'Website', icon: <Link className="size-4" /> },
  { type: 'github', label: 'GitHub',  icon: <GitBranch className="size-4" /> },
  { type: 'wallet', label: 'Wallet',  icon: <Wallet className="size-4" /> },
];

const OTHER_TYPES: Array<{ type: FieldType; label: string; icon: React.ReactNode }> = [
  { type: 'file', label: 'File', icon: <Paperclip className="size-4" /> },
];

function PaletteGroup({
  label,
  cols,
  items,
  onAdd,
}: {
  label: string;
  cols: number;
  items: Array<{ type: FieldType; label: string; icon: React.ReactNode }>;
  onAdd: (type: FieldType) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <FieldTypeButton key={item.type} {...item} onClick={onAdd} />
        ))}
      </div>
    </div>
  );
}

export function FieldPalette() {
  const addField = useBuilderStore((s) => s.addField);

  return (
    <div className="space-y-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Field Types</p>

      <PaletteGroup label="Basic"        cols={2} items={BASIC_TYPES}  onAdd={addField} />
      <PaletteGroup label="Choice"       cols={2} items={CHOICE_TYPES} onAdd={addField} />
      <PaletteGroup label="Links & Web3" cols={3} items={LINK_TYPES}   onAdd={addField} />
      <PaletteGroup label="Other"        cols={3} items={OTHER_TYPES}  onAdd={addField} />
    </div>
  );
}
