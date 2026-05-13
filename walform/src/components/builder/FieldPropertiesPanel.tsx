'use client';

import { Lock, Trash2 } from 'lucide-react';
import { useBuilderStore } from '@/store/builder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FieldOptionsEditor } from './FieldOptionsEditor';
import { Separator } from '@/components/ui/separator';

const OPTIONS_TYPES = new Set(['dropdown', 'checkbox', 'radio']);

export function FieldPropertiesPanel() {
  const selectedFieldId = useBuilderStore((s) => s.selectedFieldId);
  const fields = useBuilderStore((s) => s.config.fields);
  const updateField = useBuilderStore((s) => s.updateField);
  const removeField = useBuilderStore((s) => s.removeField);
  const setSelectedFieldId = useBuilderStore((s) => s.setSelectedFieldId);

  const field = fields.find((f) => f.id === selectedFieldId);

  if (!field) {
    return (
      <div className="mt-6 flex items-center justify-center rounded-xl border border-dashed py-8 text-sm text-[#6c8289]"
        style={{ borderColor: 'var(--hub-border)' }}>
        Select a field to edit its properties
      </div>
    );
  }

  const handleDelete = () => {
    removeField(field.id);
    setSelectedFieldId(null);
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#124741]">Field Properties</h3>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-[#91a8ae] capitalize">Type: {field.type}</p>
        </div>
      </div>
      <Separator />

      <div className="space-y-3">
        {/* Label + Placeholder */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Label</Label>
          <Input
            value={field.label}
            onChange={(e) => updateField(field.id, { label: e.target.value })}
            placeholder="Field label"
            className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Placeholder</Label>
          <Input
            value={field.placeholder ?? ''}
            onChange={(e) =>
              updateField(field.id, { placeholder: e.target.value || undefined })
            }
            placeholder="Placeholder text"
            className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
          />
        </div>

        {/* Help text */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">
            Help text <span className="text-[#aabfc4] font-normal normal-case tracking-normal">(optional)</span>
          </Label>
          <Input
            value={field.helpText ?? ''}
            onChange={(e) =>
              updateField(field.id, { helpText: e.target.value || undefined })
            }
            placeholder="Shown below the field"
            className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
          />
        </div>

        {/* Number-specific: min / max */}
        {field.type === 'number' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Min value</Label>
              <Input
                type="number"
                value={field.validation.min ?? ''}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      min: e.target.value !== '' ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="No limit"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Max value</Label>
              <Input
                type="number"
                value={field.validation.max ?? ''}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      max: e.target.value !== '' ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="No limit"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
          </div>
        )}

        {/* Text / Textarea: min/max length */}
        {(field.type === 'text' || field.type === 'textarea') && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Min length</Label>
              <Input
                type="number"
                value={field.validation.minLength ?? ''}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      minLength: e.target.value !== '' ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="None"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Max length</Label>
              <Input
                type="number"
                value={field.validation.maxLength ?? ''}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      maxLength: e.target.value !== '' ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="None"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
          </div>
        )}

        {/* File-specific settings */}
        {field.type === 'file' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Allowed types</Label>
              <Input
                value={(field.validation.allowedFileTypes ?? []).join(', ')}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      allowedFileTypes: e.target.value
                        ? e.target.value.split(',').map((s) => s.trim())
                        : undefined,
                    },
                  })
                }
                placeholder=".pdf, .png, image/*"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Max size (MB)</Label>
              <Input
                type="number"
                value={field.validation.maxFileSizeMB ?? ''}
                onChange={(e) =>
                  updateField(field.id, {
                    validation: {
                      ...field.validation,
                      maxFileSizeMB: e.target.value !== '' ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="No limit"
                className="border-[#c8ddd9] bg-white text-[#124741] placeholder:text-[#aabfc4]"
              />
            </div>
          </div>
        )}

        {/* Options editor for dropdown / checkbox / radio */}
        {OPTIONS_TYPES.has(field.type) && (
          <FieldOptionsEditor
            options={field.options ?? []}
            onChange={(opts) => updateField(field.id, { options: opts })}
          />
        )}

        <Separator />

        {/* Toggles */}
        <div className="flex flex-col gap-1 rounded-xl border p-3"
          style={{ background: '#f7fbfa', borderColor: 'var(--hub-border)' }}>
          <div className="flex items-center justify-between py-1.5">
            <Label className="cursor-pointer text-sm font-semibold text-[#124741]">Required field</Label>
            <Switch
              checked={field.validation.required ?? false}
              onCheckedChange={(v) =>
                updateField(field.id, { validation: { ...field.validation, required: v } })
              }
            />
          </div>

          <div className="flex items-center justify-between py-1.5">
            <Label className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#124741]">
              <Lock className="size-3.5 text-[#91e0da]" /> Encrypt (Seal)
            </Label>
            <Switch
              checked={field.isSensitive}
              onCheckedChange={(v) => updateField(field.id, { isSensitive: v })}
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleDelete}
          >
            <Trash2 className="size-4 mr-2" /> Delete field
          </Button>
        </div>
      </div>
    </div>
  );
}
