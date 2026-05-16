'use client';

import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RatingInput } from './RatingInput';
import { FileUploader } from './FileUploader';
import type { FormField } from '@/types/form';

interface FieldRendererProps {
  field: FormField;
  // editable mode
  value?: unknown;
  onChange?: (value: unknown) => void;
  // preview / read-only mode
  readOnly?: boolean;
  // file upload callback — only used in editable mode
  onFileUploaded?: (fieldId: string, blobId: string, file: File, encKey?: string) => void;
  // hide the built-in label row (when a parent wrapper already renders the label)
  hideLabel?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  readOnly = false,
  onFileUploaded,
  hideLabel = false,
}: FieldRendererProps) {
  const strVal = typeof value === 'string' ? value : '';
  const numVal = typeof value === 'number' ? value : 0;
  const arrVal = Array.isArray(value) ? (value as string[]) : [];

  function toggleCheckbox(option: string) {
    if (arrVal.includes(option)) {
      onChange?.(arrVal.filter((v) => v !== option));
    } else {
      onChange?.([...arrVal, option]);
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Label row — hidden when parent provides its own label */}
      {!hideLabel && (
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">
            {field.label}
            {field.validation.required && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </Label>
          {field.isSensitive && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Lock className="size-3" /> Encrypted
            </Badge>
          )}
        </div>
      )}

      {/* Input based on type */}
      {(field.type === 'text') && (
        <Input
          type="text"
          placeholder={field.placeholder}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        />
      )}

      {field.type === 'email' && (
        <Input
          type="email"
          placeholder={field.placeholder ?? 'email@example.com'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        />
      )}

      {field.type === 'url' && (
        <Input
          type="url"
          placeholder={field.placeholder ?? 'https://'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        />
      )}

      {field.type === 'github' && (
        <Input
          type="url"
          placeholder={field.placeholder ?? 'https://github.com/username'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
          pattern="https://github\.com/.+"
          title="Must be a valid GitHub URL (https://github.com/...)"
        />
      )}

      {field.type === 'phone' && (
        <Input
          type="tel"
          placeholder={field.placeholder ?? '+1 (555) 000-0000'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        />
      )}

      {field.type === 'number' && (
        <Input
          type="number"
          placeholder={field.placeholder ?? '0'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={readOnly}
          required={field.validation.required}
          min={field.validation.min}
          max={field.validation.max}
        />
      )}

      {field.type === 'date' && (
        <Input
          type="date"
          placeholder={field.placeholder}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        />
      )}

      {field.type === 'wallet' && (
        <Input
          type="text"
          placeholder={field.placeholder ?? '0x...'}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
          pattern="0x[0-9a-fA-F]{64}"
          title="Must be a valid Sui wallet address (0x followed by 64 hex characters)"
          className="font-mono text-sm"
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          placeholder={field.placeholder}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          rows={4}
          required={field.validation.required}
        />
      )}

      {field.type === 'dropdown' && (
        <select
          className="h-9 w-full rounded-lg border bg-white px-2.5 text-sm text-[#124741] focus:outline-none focus:ring-2 focus:ring-[rgba(145,224,218,0.4)] focus:border-[#91e0da] disabled:opacity-50 disabled:bg-[#f4fcf7]"
          style={{ borderColor: '#c8ddd9' }}
          value={strVal}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          required={field.validation.required}
        >
          <option value="" className="text-[#aabfc4]">Select an option…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} className="text-[#124741]">
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`${field.id}-${opt}`}
                checked={arrVal.includes(opt)}
                onCheckedChange={() => !readOnly && toggleCheckbox(opt)}
                disabled={readOnly}
              />
              <label
                htmlFor={`${field.id}-${opt}`}
                className="cursor-pointer text-sm font-normal"
              >
                {opt}
              </label>
            </div>
          ))}
        </div>
      )}

      {field.type === 'radio' && (
        <RadioGroup
          value={strVal}
          onValueChange={(v: string) => !readOnly && onChange?.(v)}
        >
          {(field.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem
                id={`${field.id}-${opt}`}
                value={opt}
                disabled={readOnly}
              />
              <label
                htmlFor={`${field.id}-${opt}`}
                className="cursor-pointer text-sm font-normal"
              >
                {opt}
              </label>
            </div>
          ))}
        </RadioGroup>
      )}

      {field.type === 'rating' && (
        <RatingInput
          value={numVal}
          onChange={(v) => onChange?.(v)}
          readOnly={readOnly}
        />
      )}

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}

      {field.type === 'file' && (
        readOnly ? (
          <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground">
            Drop file here or click to upload
          </div>
        ) : (
          <FileUploader
            accept={field.validation.allowedFileTypes?.join(',')}
            maxSizeMB={field.validation.maxFileSizeMB}
            isSensitive={field.isSensitive}
            onUploaded={(blobId, file, encKey) => {
              onChange?.(blobId);
              onFileUploaded?.(field.id, blobId, file, encKey);
            }}
          />
        )
      )}
    </div>
  );
}
