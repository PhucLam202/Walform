'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingInputProps {
  value?: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  max?: number;
}

export function RatingInput({ value = 0, onChange, readOnly = false, max = 5 }: RatingInputProps) {
  const [hovered, setHovered] = useState(0);

  const display = hovered || value;

  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={cn(
            'transition-colors',
            readOnly ? 'cursor-default' : 'cursor-pointer',
          )}
          aria-label={`Rate ${star} out of ${max}`}
        >
          <Star
            className={cn(
              'size-6',
              star <= display
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-muted-foreground',
            )}
          />
        </button>
      ))}
    </div>
  );
}
