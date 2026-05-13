export type FieldType =
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'rating'
  | 'url'
  | 'email'
  | 'file'
  | 'github'
  | 'phone'
  | 'number'
  | 'date'
  | 'wallet';

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  isSensitive: boolean;
  options?: string[];
  validation: FieldValidation;
  order: number;
}

export interface FormConfig {
  id: string;
  title: string;
  description: string;
  form_type: string;
  version: number;
  fields: FormField[];
  sensitiveFieldIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FormOnChain {
  id: string;
  owner: string;
  title: string;
  description: string;
  form_type: string;
  version: number;
  config_blob_id: string;
  submissions_index_blob_id: string | null;
  annotations_blob_id: string | null;
  last_index_updated: number;
  is_active: boolean;
  submission_count: number;
  created_at: number;
}
