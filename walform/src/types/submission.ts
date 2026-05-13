export interface SubmissionBlob {
  formId: string;
  formVersion: number;
  submittedAt: number;
  plainFields: Record<string, unknown>;
  encryptedFields?: string;
  sealRef?: string;
  fileBlobs?: Record<string, { blobId: string; mimeType: string; fileName: string } | string>;
}

export interface SubmissionIndex {
  formId: string;
  version: number;
  blobIds: string[];
  updatedAt: number;
}

export type SubmissionStatus = 'new' | 'in_progress' | 'resolved' | 'spam';

export type SubmissionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SubmissionAnnotation {
  status: SubmissionStatus;
  priority: SubmissionPriority;
  note: string;
  updatedAt: number;
}

export interface CreatorAnnotations {
  formId: string;
  annotations: Record<string, SubmissionAnnotation>;
}

export interface AnnotationsBlob {
  formId: string;
  version: number;
  annotations: Record<string, SubmissionAnnotation>;
  updatedAt: number;
}
