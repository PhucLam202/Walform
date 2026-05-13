'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadLargeFile } from '@/lib/walrus';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onUploaded: (blobId: string, file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function FileUploader({ onUploaded, accept, maxSizeMB = 50 }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; blobId: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File exceeds ${maxSizeMB} MB limit`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { blobId } = await uploadLargeFile(file, (pct) => setProgress(pct));
      setUploadedFile({ name: file.name, blobId });
      onUploaded(blobId, file);
      toast.success('File uploaded to Walrus');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Upload failed: ' + msg);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <CheckCircle2 className="size-5 shrink-0 text-green-600" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{uploadedFile.name}</p>
          <p className="text-xs text-muted-foreground">blob: {uploadedFile.blobId.slice(0, 16)}…</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setUploadedFile(null);
            setProgress(0);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20',
        uploading && 'pointer-events-none opacity-70',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      <Paperclip className="size-6 text-muted-foreground" />
      {uploading ? (
        <div className="w-full max-w-[200px] space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-center text-xs text-muted-foreground">{progress}% uploading…</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium">Drop file here or click to upload</p>
          <p className="text-xs text-muted-foreground">Max {maxSizeMB} MB · Stored on Walrus</p>
        </>
      )}
    </div>
  );
}
