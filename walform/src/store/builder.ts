import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { FormField, FormConfig, FieldType } from '@/types/form';

interface BuilderStore {
  config: FormConfig;
  setTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setFormType: (type: string) => void;
  addField: (type: FieldType, index?: number) => void;
  removeField: (id: string) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  reorderFields: (fromIdx: number, toIdx: number) => void;
  loadTemplate: (template: Partial<FormConfig>) => void;
  reset: () => void;
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
}

const defaultConfig = (): FormConfig => ({
  id: nanoid(),
  title: '',
  description: '',
  form_type: 'custom',
  version: 0,
  fields: [],
  sensitiveFieldIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useBuilderStore = create<BuilderStore>((set) => ({
  config: defaultConfig(),
  selectedFieldId: null,

  setSelectedFieldId: (id) => set({ selectedFieldId: id }),

  setTitle: (title) => set((s) => ({ config: { ...s.config, title } })),
  setDescription: (description) => set((s) => ({ config: { ...s.config, description } })),
  setFormType: (form_type) => set((s) => ({ config: { ...s.config, form_type } })),

  addField: (type, index) =>
    set((s) => {
      const LABELS: Record<string, string> = {
        text: 'Text field', textarea: 'Long text', dropdown: 'Dropdown',
        checkbox: 'Checkbox', radio: 'Radio', rating: 'Rating',
        url: 'Website URL', email: 'Email address', file: 'File upload',
        github: 'GitHub profile', phone: 'Phone number', number: 'Number',
        date: 'Date', wallet: 'Sui wallet address',
      };
      const PLACEHOLDERS: Record<string, string> = {
        url: 'https://', github: 'https://github.com/username',
        email: 'email@example.com', phone: '+1 (555) 000-0000',
        wallet: '0x...', number: '0',
      };
      const newField: FormField = {
        id: nanoid(),
        type,
        label: LABELS[type] ?? type,
        placeholder: PLACEHOLDERS[type],
        isSensitive: type === 'email' || type === 'wallet',
        options: ['dropdown', 'checkbox', 'radio'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
        validation: { required: false },
        order: 0, // will be updated below
      };
      
      const newFields = [...s.config.fields];
      if (index !== undefined && index >= 0 && index <= newFields.length) {
        newFields.splice(index, 0, newField);
      } else {
        newFields.push(newField);
      }
      
      // Update order
      return { config: { ...s.config, fields: newFields.map((f, i) => ({ ...f, order: i })) } };
    }),

  removeField: (id) =>
    set((s) => ({
      config: {
        ...s.config,
        fields: s.config.fields.filter((f) => f.id !== id),
        sensitiveFieldIds: s.config.sensitiveFieldIds.filter((sid) => sid !== id),
      },
    })),

  updateField: (id, updates) =>
    set((s) => ({
      config: {
        ...s.config,
        fields: s.config.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        sensitiveFieldIds:
          updates.isSensitive !== undefined
            ? updates.isSensitive
              ? [...new Set([...s.config.sensitiveFieldIds, id])]
              : s.config.sensitiveFieldIds.filter((sid) => sid !== id)
            : s.config.sensitiveFieldIds,
      },
    })),

  reorderFields: (fromIdx, toIdx) =>
    set((s) => {
      const fields = [...s.config.fields];
      const [moved] = fields.splice(fromIdx, 1);
      fields.splice(toIdx, 0, moved);
      return { config: { ...s.config, fields: fields.map((f, i) => ({ ...f, order: i })) } };
    }),

  loadTemplate: (template) =>
    set(() => ({
      config: {
        ...defaultConfig(),
        ...template,
        fields: (template.fields ?? []).map((f, i) => ({ ...f, id: nanoid(), order: i })),
      },
    })),

  reset: () => set({ config: defaultConfig() }),
}));
