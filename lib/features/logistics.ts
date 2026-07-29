export const LOGISTICS_LANDING_ENABLED = true;

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export const LOGISTICS_REQUEST_FORM_ENABLED = isExplicitlyEnabled(
  process.env.LOGISTICS_REQUEST_FORM_ENABLED
);

// Stage Logistics 4 is preview-only. This gate must not be environment-driven yet.
export const LOGISTICS_REQUEST_SUBMIT_ENABLED = false;
