'use client';

import { useBuilderStore } from '@/store/builder';
import { FieldRenderer } from '@/components/form/FieldRenderer';

export function FormPreview() {
  const config = useBuilderStore((s) => s.config);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{config.title || 'Untitled Form'}</h2>
        {config.description && (
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>

      {config.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fields added yet.</p>
      ) : (
        <div className="space-y-5">
          {config.fields.map((field) => (
            <FieldRenderer key={field.id} field={field} readOnly />
          ))}
        </div>
      )}
    </div>
  );
}
