import { getUploadMaxSizeBytes, isAllowedUpload } from '@/lib/files/upload-policy';

export type ParsedRequestInput = {
  formType: 'detailed';
  source?: 'client';
  vehicleId?: string;
  contactName: string;
  companyName?: string;
  phone: string;
  email?: string;
  description: string;
  equipmentType?: string;
  manufacturer?: string;
  model?: string;
  vehicleYear?: number;
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

function readVehicleYear(formData: FormData) {
  const rawValue = readString(formData, 'vehicleYear');

  if (!rawValue) {
    return undefined;
  }

  const year = Number(rawValue);
  return Number.isInteger(year) ? year : Number.NaN;
}

export function parseRequestFormData(formData: FormData): { data?: ParsedRequestInput; errors: string[] } {
  const errors: string[] = [];
  const source = readString(formData, 'source') === 'client' ? 'client' : undefined;
  const vehicleId = readString(formData, 'vehicleId');
  const companyName = readString(formData, 'companyName');
  const contactName = readString(formData, 'contactName') || companyName;
  const phone = readString(formData, 'phone');
  const email = readString(formData, 'email');
  const description = readString(formData, 'description');
  const vehicleYear = readVehicleYear(formData);
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

  if (Number.isNaN(vehicleYear) || (vehicleYear && (vehicleYear < 1900 || vehicleYear > 2100))) {
    errors.push('Вкажіть коректний рік випуску або залиште поле порожнім.');
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
      formType: 'detailed',
      source,
      vehicleId: vehicleId || undefined,
      contactName,
      companyName: companyName || undefined,
      phone,
      email: email || undefined,
      description,
      equipmentType: readString(formData, 'equipmentType') || undefined,
      manufacturer: readString(formData, 'manufacturer') || undefined,
      model: readString(formData, 'model') || undefined,
      vehicleYear: vehicleYear || undefined,
      vinOrSerial: readString(formData, 'vinOrSerial') || undefined,
      comment: readString(formData, 'comment') || undefined,
      files
    }
  };
}
