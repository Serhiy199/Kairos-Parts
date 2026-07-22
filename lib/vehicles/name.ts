export const VEHICLE_NAME_MIN_LENGTH = 2;
export const VEHICLE_NAME_MAX_LENGTH = 120;

export function normalizeVehicleName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validateVehicleName(value: unknown) {
  const name = normalizeVehicleName(value);

  if (name.length < VEHICLE_NAME_MIN_LENGTH) {
    return { ok: false as const, message: 'Вкажіть назву техніки.' };
  }
  if (name.length > VEHICLE_NAME_MAX_LENGTH) {
    return { ok: false as const, message: 'Назва техніки не може містити більше 120 символів.' };
  }
  return { ok: true as const, name };
}

function comparisonKey(value: string) {
  return normalizeVehicleName(value).toLocaleLowerCase('uk-UA');
}

export function getVehicleDisplay(vehicle: {
  name: string;
  manufacturer?: string | null;
  model?: string | null;
}) {
  const title = normalizeVehicleName(vehicle.name) || 'Техніка';
  const secondaryParts = [vehicle.manufacturer, vehicle.model]
    .map((value) => normalizeVehicleName(value))
    .filter(Boolean);
  const comparisonSecondary = secondaryParts.join(' ');
  const secondary = secondaryParts.join(' · ');

  return {
    title,
    secondary: secondary && comparisonKey(comparisonSecondary) !== comparisonKey(title) ? secondary : null
  };
}
