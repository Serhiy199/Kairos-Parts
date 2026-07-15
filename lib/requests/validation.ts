import { getUploadMaxSizeBytes, isAllowedUpload } from '@/lib/files/upload-policy';

export type ParsedRequestInput = {
  formType: 'detailed';
  source?: 'client';
  vehicleId?: string;
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  description: string;
  equipmentType: string;
  manufacturer: string;
  model: string;
  vehicleYear: number;
  vinOrSerial: string;
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
    return Number.NaN;
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
  const equipmentType = readString(formData, 'equipmentType');
  const manufacturer = readString(formData, 'manufacturer');
  const model = readString(formData, 'model');
  const vehicleYear = readVehicleYear(formData);
  const vinOrSerial = readString(formData, 'vinOrSerial');
  const files = readFiles(formData);

  if (!contactName) {
    errors.push('Вкажіть імʼя контактної особи.');
  }

  if (!companyName) {
    errors.push('Вкажіть назву компанії.');
  }

  if (!phone) {
    errors.push('Вкажіть телефон.');
  }

  if (!email) {
    errors.push('Вкажіть email.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Вкажіть коректний email.');
  }

  if (!equipmentType) {
    errors.push('Оберіть тип техніки.');
  }

  if (!manufacturer) {
    errors.push('Вкажіть виробника або марку техніки.');
  }

  if (!model) {
    errors.push('Вкажіть модель техніки.');
  }

  if (Number.isNaN(vehicleYear) || vehicleYear < 1950 || vehicleYear > 2100) {
    errors.push('Вкажіть коректний рік випуску техніки.');
  }

  if (!vinOrSerial) {
    errors.push('Вкажіть VIN або серійний номер техніки.');
  }

  if (!description) {
    errors.push('Опишіть потребу або додайте коментар до заявки.');
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
      companyName,
      phone,
      email,
      description,
      equipmentType,
      manufacturer,
      model,
      vehicleYear,
      vinOrSerial,
      comment: readString(formData, 'comment') || undefined,
      files
    }
  };
}
