'use client';

import { useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBuilderStore } from '@/store/builder';
import type { FieldType } from '@/types/form';
import { FieldTypeButton } from './FieldTypeButton';
import { FieldEditor } from './FieldEditor';

interface BuilderDndContextProps {
  children: React.ReactNode;
}

export function BuilderDndContext({ children }: BuilderDndContextProps) {
  const fields = useBuilderStore((s) => s.config.fields);
  const reorderFields = useBuilderStore((s) => s.reorderFields);
  const addField = useBuilderStore((s) => s.addField);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFieldType, setActiveFieldType] = useState<FieldType | null>(null);
  const isPaletteItemRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
    if (active.data.current?.type === 'palette') {
      isPaletteItemRef.current = true;
      setActiveFieldType(active.data.current.fieldType);
    } else {
      isPaletteItemRef.current = false;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    // Handling drag over can be used if we want to show a placeholder
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeData = active.data.current;
    
    // Check if it was a palette item BEFORE clearing state
    const isPalette = activeData?.type === 'palette';

    if (over) {
      if (isPalette && activeData?.fieldType) {
        // Dropped from palette
        const fieldType = activeData.fieldType as FieldType;
        let insertIndex = fields.length;
        if (over.id !== 'canvas') {
          const overIndex = fields.findIndex((f) => f.id === over.id);
          if (overIndex !== -1) {
            insertIndex = overIndex;
          }
        }
        addField(fieldType, insertIndex);
      } else {
        // Reordering existing fields
        if (active.id !== over.id) {
          const fromIdx = fields.findIndex((f) => f.id === active.id);
          const toIdx = fields.findIndex((f) => f.id === over.id);
          if (fromIdx !== -1 && toIdx !== -1) {
            reorderFields(fromIdx, toIdx);
          }
        }
      }
    }

    // Clear state AFTER logic
    setActiveId(null);
    setActiveFieldType(null);
  }

  // Use ref (not state) so dropAnimation is still correct in the re-render after
  // handleDragEnd clears activeId — state-based checks would flip to the wrong value.
  const dropAnimation = isPaletteItemRef.current ? null : {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  const activeField = fields.find((f) => f.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeFieldType ? (
          <div className="flex h-12 items-center gap-3 rounded-lg border border-primary bg-background px-4 py-2 shadow-2xl scale-105 transition-transform pointer-events-none ring-2 ring-primary/20">
            <div className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
               {/* Simplified icon representation since we don't have the icon map here easily */}
               <div className="size-3.5 rounded-sm border-2 border-current" />
            </div>
            <span className="text-sm font-medium capitalize">{activeFieldType.replace('_', ' ')}</span>
          </div>
        ) : activeField ? (
          <div className="opacity-90 scale-[1.02] transition-transform pointer-events-none shadow-2xl rounded-lg border border-primary/50">
            <FieldEditor field={activeField} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
