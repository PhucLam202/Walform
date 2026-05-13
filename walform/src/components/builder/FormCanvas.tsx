'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useBuilderStore } from '@/store/builder';
import { FieldEditor } from './FieldEditor';
import { Button } from '@/components/ui/button';

function SortableFieldEditor({ fieldId }: { fieldId: string }) {
  const field = useBuilderStore((s) => s.config.fields.find((f) => f.id === fieldId));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldId,
  });

  if (!field) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <FieldEditor
        field={field}
        dragHandle={
          <div
            {...attributes}
            {...listeners}
            className="flex h-full w-full cursor-grab items-center justify-center touch-none text-muted-foreground hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </div>
        }
      />
    </div>
  );
}

export function FormCanvas() {
  const fields = useBuilderStore((s) => s.config.fields);
  const setSelectedFieldId = useBuilderStore((s) => s.setSelectedFieldId);

  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  if (fields.length === 0) {
    return (
      <div 
        ref={setNodeRef}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center h-96"
      >
        <div className="mb-4 rounded-full bg-muted/50 p-4">
          <GripVertical className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Build your form</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Drag and drop fields from the left palette to start building your form. 
        </p>
        <Button className="mt-6" variant="outline" onClick={() => {
          const addField = useBuilderStore.getState().addField;
          addField('text');
        }}>
          Add Text Field
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      className="min-h-[500px]" 
      onClick={(e) => {
        // Only deselect if clicking directly on the canvas background
        if (e.target === e.currentTarget) setSelectedFieldId(null);
      }}
    >
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {fields.map((f) => (
            <SortableFieldEditor key={f.id} fieldId={f.id} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
