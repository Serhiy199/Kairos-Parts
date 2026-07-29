export const LOGISTICS_LANDING_ENABLED = true;

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export const LOGISTICS_REQUEST_FORM_ENABLED = isExplicitlyEnabled(
  process.env.LOGISTICS_REQUEST_FORM_ENABLED
);

export const LOGISTICS_REQUEST_SUBMIT_ENABLED = isExplicitlyEnabled(
  process.env.LOGISTICS_REQUEST_SUBMIT_ENABLED
);
