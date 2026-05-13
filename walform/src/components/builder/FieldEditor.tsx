'use client';

import { Lock, Star, Edit2 } from 'lucide-react';
import { useBuilderStore } from '@/store/builder';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FormField } from '@/types/form';

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  textarea: 'Long Text',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  radio: 'Radio',
  rating: 'Rating',
  url: 'URL',
  email: 'Email',
  file: 'File',
  github: 'GitHub',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  wallet: 'Wallet',
};

interface FieldEditorProps {
  field: FormField;
  dragHandle?: React.ReactNode;
}

export function FieldEditor({ field, dragHandle }: FieldEditorProps) {
  const selectedFieldId = useBuilderStore((s) => s.selectedFieldId);
  const setSelectedFieldId = useBuilderStore((s) => s.setSelectedFieldId);
  const updateField = useBuilderStore((s) => s.updateField);
  
  const isSelected = selectedFieldId === field.id;

  return (
    <div 
      className={cn(
        "group relative flex rounded-lg border bg-background shadow-sm transition-colors",
        isSelected ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-border/80"
      )}
      onClick={() => setSelectedFieldId(field.id)}
    >
      {/* Left Handle Area */}
      <div className="flex w-10 shrink-0 items-center justify-center border-r border-border/50 bg-muted/20">
        {dragHandle}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                className="h-7 border-transparent bg-transparent px-1 py-0 text-sm font-medium hover:border-input focus-visible:ring-1"
                onClick={(e) => e.stopPropagation()}
              />
              {field.validation.required && (
                <Star className="size-3 text-destructive shrink-0" />
              )}
              {field.isSensitive && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
                  <Lock className="mr-1 size-2.5" /> Encrypted
                </Badge>
              )}
            </div>
            
            {/* Mock input to give visual feedback of the field type */}
            <div className="mt-2 text-sm text-muted-foreground">
              <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm opacity-50 flex items-center">
                {field.placeholder || `Enter ${FIELD_TYPE_LABELS[field.type]?.toLowerCase() ?? field.type}...`}
              </div>
            </div>
            
            {field.helpText && (
              <p className="text-xs text-muted-foreground mt-1 px-1">
                {field.helpText}
              </p>
            )}
          </div>

          <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground capitalize font-normal">
            {FIELD_TYPE_LABELS[field.type] ?? field.type}
          </Badge>
        </div>
      </div>
      
      {/* Right overlay icons when active/hover */}
      <div className={cn(
        "absolute right-2 -top-3 flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <button
          className={cn("rounded p-1.5 hover:bg-muted text-muted-foreground", field.validation.required && "text-primary")}
          onClick={(e) => {
            e.stopPropagation();
            updateField(field.id, { validation: { ...field.validation, required: !field.validation.required } });
          }}
          title="Toggle Required"
        >
          <Star className={cn("size-3.5", field.validation.required && "fill-current")} />
        </button>
        <button
          className="rounded p-1.5 hover:bg-muted text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFieldId(field.id);
          }}
          title="Edit Properties"
        >
          <Edit2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
