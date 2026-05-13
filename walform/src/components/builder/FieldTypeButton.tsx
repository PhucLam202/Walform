'use client';

import { useDraggable } from '@dnd-kit/core';
import type { FieldType } from '@/types/form';
import { cn } from '@/lib/utils';

interface FieldTypeButtonProps {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
  onClick: (type: FieldType) => void;
}

export function FieldTypeButton({ type, label, icon, onClick }: FieldTypeButtonProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: {
      type: 'palette',
      fieldType: type,
    },
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={cn(
        'flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 transition',
        'cursor-grab active:cursor-grabbing',
        'hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700',
        isDragging && 'border-dashed opacity-50',
      )}
      onClick={() => onClick(type)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
