import type { LogisticsTariffCityCode } from '@/lib/logistics/tariff-cities';
import { LOGISTICS_TARIFF_CITY_CODES } from '@/lib/logistics/tariff-cities';

export type SyntheticLogisticsAddressFixture = {
  externalAddressId: string;
  formattedAddress: string;
  normalizedLocality: string;
  normalizedAdministrativeArea: string;
  tariffCityCodes: readonly LogisticsTariffCityCode[];
  kaharlykCommunity: boolean;
};

const tariffFixture = (
  externalAddressId: string,
  formattedAddress: string,
  normalizedLocality: string,
  tariffCityCodes: readonly LogisticsTariffCityCode[],
  normalizedAdministrativeArea = 'Київська область'
): SyntheticLogisticsAddressFixture => ({
  externalAddressId,
  formattedAddress,
  normalizedLocality,
  normalizedAdministrativeArea,
  tariffCityCodes,
  kaharlykCommunity: false
});

const communityFixture = (
  externalAddressId: string,
  formattedAddress: string
): SyntheticLogisticsAddressFixture => ({
  externalAddressId,
  formattedAddress,
  normalizedLocality: 'Кагарлик',
  normalizedAdministrativeArea: 'Київська область',
  tariffCityCodes: [],
  kaharlykCommunity: true
});

export const SYNTHETIC_LOGISTICS_ADDRESS_FIXTURES = [
  tariffFixture(
    'mock:tariff-city:myronivka:001',
    'вул. Тестова, 1, Миронівка, Київська область',
    'Миронівка',
    [LOGISTICS_TARIFF_CITY_CODES.MYRONIVKA]
  ),
  tariffFixture(
    'mock:tariff-city:myronivka:002',
    'Тестовий промисловий майданчик, Миронівка, Київська область',
    'Миронівка',
    [LOGISTICS_TARIFF_CITY_CODES.MYRONIVKA]
  ),
  tariffFixture(
    'mock:tariff-city:obukhiv:001',
    'вул. Тестова, 1, Обухів, Київська область',
    'Обухів',
    [LOGISTICS_TARIFF_CITY_CODES.OBUKHIV]
  ),
  tariffFixture(
    'mock:tariff-city:obukhiv:002',
    'Навчальний складський майданчик, Обухів, Київська область',
    'Обухів',
    [LOGISTICS_TARIFF_CITY_CODES.OBUKHIV]
  ),
  tariffFixture(
    'mock:tariff-city:uzyn:001',
    'вул. Тестова, 1, Узин, Київська область',
    'Узин',
    [LOGISTICS_TARIFF_CITY_CODES.UZYN]
  ),
  tariffFixture(
    'mock:tariff-city:uzyn:002',
    'Тестовий логістичний майданчик, Узин, Київська область',
    'Узин',
    [LOGISTICS_TARIFF_CITY_CODES.UZYN]
  ),
  tariffFixture(
    'mock:tariff-city:vasylkiv:001',
    'вул. Тестова, 1, Васильків, Київська область',
    'Васильків',
    [LOGISTICS_TARIFF_CITY_CODES.VASYLKIV]
  ),
  tariffFixture(
    'mock:tariff-city:vasylkiv:002',
    'Навчальний промисловий майданчик, Васильків, Київська область',
    'Васильків',
    [LOGISTICS_TARIFF_CITY_CODES.VASYLKIV]
  ),
  tariffFixture(
    'mock:tariff-city:bila-tserkva:001',
    'вул. Промислова, 10, Біла Церква, Київська область',
    'Біла Церква',
    [LOGISTICS_TARIFF_CITY_CODES.BILA_TSERKVA]
  ),
  tariffFixture(
    'mock:tariff-city:bila-tserkva:002',
    'Тестовий складський майданчик, Біла Церква, Київська область',
    'Біла Церква',
    [LOGISTICS_TARIFF_CITY_CODES.BILA_TSERKVA]
  ),
  tariffFixture(
    'mock:tariff-city:boryspil:001',
    'вул. Тестова, 1, Бориспіль, Київська область',
    'Бориспіль',
    [LOGISTICS_TARIFF_CITY_CODES.BORYSPIL]
  ),
  tariffFixture(
    'mock:tariff-city:boryspil:002',
    'Навчальний вантажний майданчик, Бориспіль, Київська область',
    'Бориспіль',
    [LOGISTICS_TARIFF_CITY_CODES.BORYSPIL]
  ),
  tariffFixture(
    'mock:tariff-city:kyiv:001',
    'вул. Тестова, 1, Київ',
    'Київ',
    [
      LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK,
      LOGISTICS_TARIFF_CITY_CODES.KYIV_LEFT_BANK
    ],
    'м. Київ'
  ),
  tariffFixture(
    'mock:tariff-city:kyiv:002',
    'Тестовий логістичний майданчик, Київ',
    'Київ',
    [
      LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK,
      LOGISTICS_TARIFF_CITY_CODES.KYIV_LEFT_BANK
    ],
    'м. Київ'
  ),
  tariffFixture(
    'mock:tariff-city:brovary:001',
    'вул. Тестова, 1, Бровари, Київська область',
    'Бровари',
    [LOGISTICS_TARIFF_CITY_CODES.BROVARY]
  ),
  tariffFixture(
    'mock:tariff-city:brovary:002',
    'Навчальний складський майданчик, Бровари, Київська область',
    'Бровари',
    [LOGISTICS_TARIFF_CITY_CODES.BROVARY]
  ),
  tariffFixture(
    'mock:tariff-city:irpin:001',
    'вул. Тестова, 1, Ірпінь, Київська область',
    'Ірпінь',
    [LOGISTICS_TARIFF_CITY_CODES.IRPIN]
  ),
  tariffFixture(
    'mock:tariff-city:irpin:002',
    'Тестовий вантажний майданчик, Ірпінь, Київська область',
    'Ірпінь',
    [LOGISTICS_TARIFF_CITY_CODES.IRPIN]
  ),
  tariffFixture(
    'mock:tariff-city:bucha:001',
    'вул. Тестова, 1, Буча, Київська область',
    'Буча',
    [LOGISTICS_TARIFF_CITY_CODES.BUCHA]
  ),
  tariffFixture(
    'mock:tariff-city:bucha:002',
    'Навчальний логістичний майданчик, Буча, Київська область',
    'Буча',
    [LOGISTICS_TARIFF_CITY_CODES.BUCHA]
  ),
  tariffFixture(
    'mock:tariff-city:berezan:001',
    'вул. Тестова, 1, Березань, Київська область',
    'Березань',
    [LOGISTICS_TARIFF_CITY_CODES.BEREZAN]
  ),
  tariffFixture(
    'mock:tariff-city:berezan:002',
    'Тестовий промисловий майданчик, Березань, Київська область',
    'Березань',
    [LOGISTICS_TARIFF_CITY_CODES.BEREZAN]
  ),
  tariffFixture(
    'mock:tariff-city:vyshhorod:001',
    'вул. Тестова, 1, Вишгород, Київська область',
    'Вишгород',
    [LOGISTICS_TARIFF_CITY_CODES.VYSHHOROD]
  ),
  tariffFixture(
    'mock:tariff-city:vyshhorod:002',
    'Навчальний складський майданчик, Вишгород, Київська область',
    'Вишгород',
    [LOGISTICS_TARIFF_CITY_CODES.VYSHHOROD]
  ),
  communityFixture(
    'mock:community:kaharlyk:001',
    'Тестовий аграрний майданчик, Кагарлик, Київська область'
  ),
  communityFixture(
    'mock:community:kaharlyk:002',
    'Навчальний складський майданчик, Кагарлик, Київська область'
  )
] as const satisfies readonly SyntheticLogisticsAddressFixture[];
