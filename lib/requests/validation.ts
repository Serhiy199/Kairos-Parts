import { getCategoryBySlug } from '@/lib/catalog/catalog-data';
import { getUploadMaxSizeBytes, isAllowedUpload } from '@/lib/files/upload-policy';

export type ParsedRequestInput = {
  formType: 'quick' | 'detailed';
  contactName: string;
  companyName?: string;
  phone: string;
  email?: string;
  description: string;
  equipmentType?: string;
  categorySlug?: string;
  manufacturer?: string;
  model?: string;
  vinOrSerial?: string;
  comment?: string;
  files: File[];
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readFiles(formData: FormData) {
  return formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function parseRequestFormData(formData: FormData): { data?: ParsedRequestInput; errors: string[] } {
  const errors: string[] = [];
  const formType = readString(formData, 'formType') === 'detailed' ? 'detailed' : 'quick';
  const companyName = readString(formData, 'companyName');
  const contactName = readString(formData, 'contactName') || companyName;
  const phone = readString(formData, 'phone');
  const email = readString(formData, 'email');
  const description = readString(formData, 'description');
  const categorySlug = readString(formData, 'category');
  const files = readFiles(formData);

  if (!contactName) {
    errors.push('Вкажіть імʼя або назву компанії.');
  }

  if (!phone) {
    errors.push('Вкажіть телефон.');
  }

  if (!description) {
    errors.push('Опишіть потребу.');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Вкажіть коректний email або залиште поле порожнім.');
  }

  if (categorySlug && !getCategoryBySlug(categorySlug)) {
    errors.push('Обрана категорія не знайдена.');
  }

  const maxSizeBytes = getUploadMaxSizeBytes();

  for (const file of files) {
    if (!isAllowedUpload(file)) {
      errors.push(`Файл "${file.name}" має непідтримуваний формат.`);
    }

    if (file.size > maxSizeBytes) {
      errors.push(`Файл "${file.name}" перевищує дозволений розмір.`);
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    data: {
      formType,
      contactName,
      companyName: companyName || undefined,
      phone,
      email: email || undefined,
      description,
      equipmentType: readString(formData, 'equipmentType') || undefined,
      categorySlug: categorySlug || undefined,
      manufacturer: readString(formData, 'manufacturer') || undefined,
      model: readString(formData, 'model') || undefined,
      vinOrSerial: readString(formData, 'vinOrSerial') || undefined,
      comment: readString(formData, 'comment') || undefined,
      files
    }
  };
}
