export function buildUsedEquipmentTitle(input: {
  type: string;
  manufacturer: string;
  model: string;
  year?: number | null;
}) {
  return [
    input.type.trim(),
    input.manufacturer.trim(),
    input.model.trim(),
    input.year ? String(input.year) : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
