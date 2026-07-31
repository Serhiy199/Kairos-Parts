import 'server-only';

import type { LogisticsAddressProvider } from '@/lib/logistics/address-provider/contracts';
import { LogisticsAddressError } from '@/lib/logistics/address-provider/errors';
import { MockAddressProvider } from '@/lib/logistics/address-provider/mock-provider';

let mockProvider: MockAddressProvider | undefined;

export function getLogisticsAddressProvider(): LogisticsAddressProvider {
  const configuredProvider = process.env.LOGISTICS_ADDRESS_PROVIDER
    ?.trim()
    .toLowerCase();

  if (!configuredProvider) {
    throw new LogisticsAddressError(
      'ADDRESS_PROVIDER_DISABLED',
      503,
      'Сервіс пошуку адрес тимчасово вимкнено.'
    );
  }

  if (configuredProvider === 'mock') {
    mockProvider ??= new MockAddressProvider();
    return mockProvider;
  }

  throw new LogisticsAddressError(
    'ADDRESS_PROVIDER_UNAVAILABLE',
    503,
    'Налаштований сервіс пошуку адрес поки недоступний.'
  );
}
