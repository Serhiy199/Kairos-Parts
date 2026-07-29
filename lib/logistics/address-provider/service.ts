import type { LogisticsAddressProvider } from '@/lib/logistics/address-provider/contracts';
import {
  parseLogisticsAddressAutocompleteInput,
  parseLogisticsAddressResolveInput,
  LOGISTICS_ADDRESS_SUGGESTION_LIMIT
} from '@/lib/logistics/address-provider/validation';

export async function autocompleteLogisticsAddresses(
  provider: LogisticsAddressProvider,
  value: unknown
) {
  const input = parseLogisticsAddressAutocompleteInput(value);

  return provider.autocomplete({
    ...input,
    limit: LOGISTICS_ADDRESS_SUGGESTION_LIMIT
  });
}

export async function resolveLogisticsAddress(
  provider: LogisticsAddressProvider,
  value: unknown
) {
  const input = parseLogisticsAddressResolveInput(value);
  return provider.resolve(input);
}
