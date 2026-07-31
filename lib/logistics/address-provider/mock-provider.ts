import type {
  LogisticsAddressProvider,
  LogisticsAddressScope,
  LogisticsAddressSuggestion
} from '@/lib/logistics/address-provider/contracts';
import { LogisticsAddressError } from '@/lib/logistics/address-provider/errors';
import {
  SYNTHETIC_LOGISTICS_ADDRESS_FIXTURES,
  type SyntheticLogisticsAddressFixture
} from '@/lib/logistics/address-provider/fixtures';

export const MOCK_LOGISTICS_ADDRESS_MAX_RESULTS = 8;

function normalizeSearchValue(value: string) {
  return value.trim().normalize('NFC').toLocaleLowerCase('uk-UA');
}

function fixtureMatchesScope(
  fixture: SyntheticLogisticsAddressFixture,
  scope: LogisticsAddressScope
) {
  if (scope.type === 'KAHARLYK_COMMUNITY') {
    return fixture.kaharlykCommunity;
  }

  return fixture.tariffCityCodes.includes(scope.tariffCityCode);
}

function toSuggestion(
  fixture: SyntheticLogisticsAddressFixture
): LogisticsAddressSuggestion {
  return {
    externalAddressId: fixture.externalAddressId,
    formattedAddress: fixture.formattedAddress,
    normalizedLocality: fixture.normalizedLocality,
    normalizedAdministrativeArea: fixture.normalizedAdministrativeArea,
    addressProvider: 'MOCK'
  };
}

export class MockAddressProvider implements LogisticsAddressProvider {
  readonly kind = 'MOCK' as const;

  async autocomplete({
    query,
    scope,
    limit
  }: Parameters<LogisticsAddressProvider['autocomplete']>[0]) {
    const normalizedQuery = normalizeSearchValue(query);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 0), MOCK_LOGISTICS_ADDRESS_MAX_RESULTS)
      : 0;

    if (!normalizedQuery || boundedLimit === 0) {
      return [];
    }

    return SYNTHETIC_LOGISTICS_ADDRESS_FIXTURES
      .filter((fixture) => fixtureMatchesScope(fixture, scope))
      .filter((fixture) =>
        normalizeSearchValue(
          `${fixture.formattedAddress} ${fixture.normalizedLocality}`
        ).includes(normalizedQuery)
      )
      .sort(
        (left, right) =>
          left.formattedAddress.localeCompare(right.formattedAddress, 'uk-UA') ||
          left.externalAddressId.localeCompare(right.externalAddressId)
      )
      .slice(0, boundedLimit)
      .map(toSuggestion);
  }

  async resolve({
    externalAddressId,
    scope
  }: Parameters<LogisticsAddressProvider['resolve']>[0]) {
    const fixture = SYNTHETIC_LOGISTICS_ADDRESS_FIXTURES.find(
      (candidate) => candidate.externalAddressId === externalAddressId
    );

    if (!fixture) {
      throw new LogisticsAddressError(
        'ADDRESS_NOT_FOUND',
        404,
        'Адресу не знайдено.'
      );
    }

    if (!fixtureMatchesScope(fixture, scope)) {
      throw new LogisticsAddressError(
        'ADDRESS_SCOPE_MISMATCH',
        422,
        'Адреса не відповідає вибраній території.'
      );
    }

    return toSuggestion(fixture);
  }
}
