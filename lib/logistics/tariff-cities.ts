export const LOGISTICS_TARIFF_CITY_CODES = {
  MYRONIVKA: 'MYRONIVKA',
  OBUKHIV: 'OBUKHIV',
  UZYN: 'UZYN',
  VASYLKIV: 'VASYLKIV',
  BILA_TSERKVA: 'BILA_TSERKVA',
  BORYSPIL: 'BORYSPIL',
  KYIV_RIGHT_BANK: 'KYIV_RIGHT_BANK',
  KYIV_LEFT_BANK: 'KYIV_LEFT_BANK',
  BROVARY: 'BROVARY',
  IRPIN: 'IRPIN',
  BUCHA: 'BUCHA',
  BEREZAN: 'BEREZAN',
  VYSHHOROD: 'VYSHHOROD'
} as const;

export type LogisticsTariffCityCode =
  (typeof LOGISTICS_TARIFF_CITY_CODES)[keyof typeof LOGISTICS_TARIFF_CITY_CODES];

export type LogisticsTariffCityDefinition = {
  code: LogisticsTariffCityCode;
  displayName: string;
  normalizedLocality: string;
  previewPriceMinorUnits: number;
};

export const LOGISTICS_TARIFF_CITIES = [
  {
    code: LOGISTICS_TARIFF_CITY_CODES.MYRONIVKA,
    displayName: 'Миронівка',
    normalizedLocality: 'Миронівка',
    previewPriceMinorUnits: 160_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.OBUKHIV,
    displayName: 'Обухів',
    normalizedLocality: 'Обухів',
    previewPriceMinorUnits: 170_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.UZYN,
    displayName: 'Узин',
    normalizedLocality: 'Узин',
    previewPriceMinorUnits: 180_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.VASYLKIV,
    displayName: 'Васильків',
    normalizedLocality: 'Васильків',
    previewPriceMinorUnits: 200_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.BILA_TSERKVA,
    displayName: 'Біла Церква',
    normalizedLocality: 'Біла Церква',
    previewPriceMinorUnits: 220_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.BORYSPIL,
    displayName: 'Бориспіль',
    normalizedLocality: 'Бориспіль',
    previewPriceMinorUnits: 240_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK,
    displayName: 'Київ — правий берег',
    normalizedLocality: 'Київ',
    previewPriceMinorUnits: 250_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.KYIV_LEFT_BANK,
    displayName: 'Київ — лівий берег',
    normalizedLocality: 'Київ',
    previewPriceMinorUnits: 260_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.BROVARY,
    displayName: 'Бровари',
    normalizedLocality: 'Бровари',
    previewPriceMinorUnits: 270_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.IRPIN,
    displayName: 'Ірпінь',
    normalizedLocality: 'Ірпінь',
    previewPriceMinorUnits: 290_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.BUCHA,
    displayName: 'Буча',
    normalizedLocality: 'Буча',
    previewPriceMinorUnits: 290_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.BEREZAN,
    displayName: 'Березань',
    normalizedLocality: 'Березань',
    previewPriceMinorUnits: 300_000
  },
  {
    code: LOGISTICS_TARIFF_CITY_CODES.VYSHHOROD,
    displayName: 'Вишгород',
    normalizedLocality: 'Вишгород',
    previewPriceMinorUnits: 320_000
  }
] as const satisfies readonly LogisticsTariffCityDefinition[];

const tariffCityByCode = new Map<
  LogisticsTariffCityCode,
  LogisticsTariffCityDefinition
>(LOGISTICS_TARIFF_CITIES.map((city) => [city.code, city]));
const tariffCityCodes = new Set<string>(
  LOGISTICS_TARIFF_CITIES.map((city) => city.code)
);

export function isLogisticsTariffCityCode(value: string): value is LogisticsTariffCityCode {
  return tariffCityCodes.has(value);
}

export function getLogisticsTariffCity(
  code: LogisticsTariffCityCode
): LogisticsTariffCityDefinition {
  const city = tariffCityByCode.get(code);
  if (!city) {
    throw new Error(`Unknown logistics tariff city: ${code}`);
  }

  return city;
}
