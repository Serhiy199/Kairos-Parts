const DECIMAL_MONEY_PATTERN = /^(\d+)(?:\.(\d+))?$/;

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

export function formatClientSelectionPrice(
  value: string | null,
  currency: string | null
) {
  if (value === null) return 'Ціна уточнюється';

  const match = DECIMAL_MONEY_PATTERN.exec(value);
  if (!match) return currency ? `${value} ${currency}` : value;

  const [, integer, fraction = ''] = match;
  const formatted = `${groupInteger(integer)},${fraction.padEnd(2, '0').slice(0, 2)}`;
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatClientSelectionQuantity(quantity: string, unit: string | null) {
  return unit ? `${quantity} ${unit}` : quantity;
}
