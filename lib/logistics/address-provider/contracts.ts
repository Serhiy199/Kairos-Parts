import type { LogisticsTariffCityCode } from '@/lib/logistics/tariff-cities';

export type LogisticsAddressProviderKind = 'MOCK' | 'GOOGLE';

export type LogisticsAddressScope =
  | {
      type: 'TARIFF_CITY';
      tariffCityCode: LogisticsTariffCityCode;
    }
  | {
      type: 'KAHARLYK_COMMUNITY';
    };

export type LogisticsAddressSuggestion = {
  externalAddressId: string;
  formattedAddress: string;
  normalizedLocality: string;
  normalizedAdministrativeArea?: string;
  addressProvider: LogisticsAddressProviderKind;
};

export type LogisticsResolvedAddress = LogisticsAddressSuggestion;

export type LogisticsAddressAutocompleteInput = {
  query: string;
  scope: LogisticsAddressScope;
  limit: number;
};

export type LogisticsAddressResolveInput = {
  externalAddressId: string;
  scope: LogisticsAddressScope;
};

export interface LogisticsAddressProvider {
  readonly kind: LogisticsAddressProviderKind;

  autocomplete(
    input: LogisticsAddressAutocompleteInput
  ): Promise<LogisticsAddressSuggestion[]>;

  resolve(input: LogisticsAddressResolveInput): Promise<LogisticsResolvedAddress>;
}
