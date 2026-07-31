import assert from 'node:assert/strict';

import type { LogisticsAddressProvider } from '../lib/logistics/address-provider/contracts';
import {
  LOGISTICS_ADDRESS_ERROR_CODES,
  LogisticsAddressError
} from '../lib/logistics/address-provider/errors';
import { MockAddressProvider } from '../lib/logistics/address-provider/mock-provider';
import { logisticsAddressErrorResponse } from '../lib/logistics/address-provider/responses';
import {
  autocompleteLogisticsAddresses,
  resolveLogisticsAddress
} from '../lib/logistics/address-provider/service';
import {
  LOGISTICS_ADDRESS_JSON_MAX_BYTES,
  LOGISTICS_ADDRESS_SUGGESTION_LIMIT,
  parseLogisticsAddressAutocompleteInput,
  readBoundedLogisticsAddressJson
} from '../lib/logistics/address-provider/validation';
import {
  getLogisticsTariffCity,
  LOGISTICS_TARIFF_CITIES,
  LOGISTICS_TARIFF_CITY_CODES
} from '../lib/logistics/tariff-cities';

async function expectAddressError(
  action: () => unknown | Promise<unknown>,
  code: LogisticsAddressError['code']
) {
  await assert.rejects(
    async () => action(),
    (error: unknown) =>
      error instanceof LogisticsAddressError && error.code === code
  );
}

async function main() {
  const codes = LOGISTICS_TARIFF_CITIES.map((city) => city.code);
  assert.equal(codes.length, 13);
  assert.equal(new Set(codes).size, 13);
  assert.deepEqual(
    LOGISTICS_TARIFF_CITIES.map((city) => city.displayName),
    [
      'Миронівка',
      'Обухів',
      'Узин',
      'Васильків',
      'Біла Церква',
      'Бориспіль',
      'Київ — правий берег',
      'Київ — лівий берег',
      'Бровари',
      'Ірпінь',
      'Буча',
      'Березань',
      'Вишгород'
    ]
  );
  assert.equal(
    getLogisticsTariffCity(LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK)
      .normalizedLocality,
    'Київ'
  );
  assert.equal(
    getLogisticsTariffCity(LOGISTICS_TARIFF_CITY_CODES.KYIV_LEFT_BANK)
      .normalizedLocality,
    'Київ'
  );
  assert.notEqual(
    LOGISTICS_TARIFF_CITY_CODES.IRPIN,
    LOGISTICS_TARIFF_CITY_CODES.BUCHA
  );

  const provider = new MockAddressProvider();
  const myronivkaScope = {
    type: 'TARIFF_CITY' as const,
    tariffCityCode: LOGISTICS_TARIFF_CITY_CODES.MYRONIVKA
  };
  const myronivka = await autocompleteLogisticsAddresses(provider, {
    query: '  ТЕСТ  ',
    scope: myronivkaScope
  });
  assert.ok(myronivka.length > 0);
  assert.ok(myronivka.every((address) => address.normalizedLocality === 'Миронівка'));
  assert.deepEqual(
    myronivka,
    await autocompleteLogisticsAddresses(provider, {
      query: '  ТЕСТ  ',
      scope: myronivkaScope
    })
  );

  const noResults = await autocompleteLogisticsAddresses(provider, {
    query: 'адреса-якої-немає',
    scope: myronivkaScope
  });
  assert.deepEqual(noResults, []);

  await expectAddressError(
    () =>
      autocompleteLogisticsAddresses(provider, {
        query: 'ab',
        scope: myronivkaScope
      }),
    'QUERY_TOO_SHORT'
  );
  await expectAddressError(
    () =>
      autocompleteLogisticsAddresses(provider, {
        query: 'a'.repeat(161),
        scope: myronivkaScope
      }),
    'QUERY_TOO_LONG'
  );
  await expectAddressError(
    () =>
      parseLogisticsAddressAutocompleteInput({
        query: 'Тест',
        scope: {
          type: 'TARIFF_CITY',
          tariffCityCode: 'UNKNOWN_CITY'
        }
      }),
    'UNKNOWN_TARIFF_CITY'
  );

  let observedLimit = 0;
  const limitCapturingProvider: LogisticsAddressProvider = {
    kind: 'MOCK',
    async autocomplete(input) {
      observedLimit = input.limit;
      return [];
    },
    async resolve() {
      throw new Error('not used');
    }
  };
  await autocompleteLogisticsAddresses(limitCapturingProvider, {
    query: 'Тест',
    scope: myronivkaScope,
    limit: 10_000
  });
  assert.equal(observedLimit, LOGISTICS_ADDRESS_SUGGESTION_LIMIT);

  const providerLimited = await provider.autocomplete({
    query: 'Миронівка',
    scope: myronivkaScope,
    limit: 1
  });
  assert.equal(providerLimited.length, 1);

  for (const city of LOGISTICS_TARIFF_CITIES) {
    const suggestions = await autocompleteLogisticsAddresses(provider, {
      query: city.normalizedLocality,
      scope: {
        type: 'TARIFF_CITY',
        tariffCityCode: city.code
      }
    });
    assert.ok(suggestions.length >= 1);
    assert.ok(
      suggestions.every(
        (suggestion) => suggestion.normalizedLocality === city.normalizedLocality
      )
    );
  }

  const communitySuggestions = await autocompleteLogisticsAddresses(provider, {
    query: 'Тест',
    scope: { type: 'KAHARLYK_COMMUNITY' }
  });
  assert.ok(communitySuggestions.length >= 1);
  assert.ok(
    communitySuggestions.every(
      (suggestion) => suggestion.normalizedLocality === 'Кагарлик'
    )
  );

  const myronivkaAddress = await resolveLogisticsAddress(provider, {
    externalAddressId: 'mock:tariff-city:myronivka:001',
    scope: myronivkaScope
  });
  assert.equal(myronivkaAddress.addressProvider, 'MOCK');
  assert.deepEqual(
    Object.keys(myronivkaAddress).sort(),
    [
      'addressProvider',
      'externalAddressId',
      'formattedAddress',
      'normalizedAdministrativeArea',
      'normalizedLocality'
    ]
  );
  const serializedAddress = JSON.stringify(myronivkaAddress);
  assert.doesNotMatch(
    serializedAddress,
    /latitude|longitude|coordinates|google|mapUrl|routeData/i
  );

  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:unknown:001',
        scope: myronivkaScope
      }),
    'ADDRESS_NOT_FOUND'
  );
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:tariff-city:myronivka:001',
        scope: {
          type: 'TARIFF_CITY',
          tariffCityCode: LOGISTICS_TARIFF_CITY_CODES.BILA_TSERKVA
        }
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:tariff-city:irpin:001',
        scope: {
          type: 'TARIFF_CITY',
          tariffCityCode: LOGISTICS_TARIFF_CITY_CODES.BUCHA
        }
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:tariff-city:bucha:001',
        scope: {
          type: 'TARIFF_CITY',
          tariffCityCode: LOGISTICS_TARIFF_CITY_CODES.IRPIN
        }
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );

  for (const kyivCode of [
    LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK,
    LOGISTICS_TARIFF_CITY_CODES.KYIV_LEFT_BANK
  ]) {
    const address = await resolveLogisticsAddress(provider, {
      externalAddressId: 'mock:tariff-city:kyiv:001',
      scope: {
        type: 'TARIFF_CITY',
        tariffCityCode: kyivCode
      }
    });
    assert.equal(address.normalizedLocality, 'Київ');
  }
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:tariff-city:brovary:001',
        scope: {
          type: 'TARIFF_CITY',
          tariffCityCode: LOGISTICS_TARIFF_CITY_CODES.KYIV_RIGHT_BANK
        }
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );

  const communityAddress = await resolveLogisticsAddress(provider, {
    externalAddressId: 'mock:community:kaharlyk:001',
    scope: { type: 'KAHARLYK_COMMUNITY' }
  });
  assert.equal(communityAddress.normalizedLocality, 'Кагарлик');
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:tariff-city:myronivka:001',
        scope: { type: 'KAHARLYK_COMMUNITY' }
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );
  await expectAddressError(
    () =>
      resolveLogisticsAddress(provider, {
        externalAddressId: 'mock:community:kaharlyk:001',
        scope: myronivkaScope
      }),
    'ADDRESS_SCOPE_MISMATCH'
  );

  await expectAddressError(
    () =>
      readBoundedLogisticsAddressJson(
        new Request('http://localhost/test', {
          method: 'POST',
          body: '{}',
          headers: { 'Content-Type': 'text/plain' }
        })
      ),
    'INVALID_REQUEST'
  );
  await expectAddressError(
    () =>
      readBoundedLogisticsAddressJson(
        new Request('http://localhost/test', {
          method: 'POST',
          body: '{invalid',
          headers: { 'Content-Type': 'application/json' }
        })
      ),
    'INVALID_REQUEST'
  );
  await expectAddressError(
    () =>
      readBoundedLogisticsAddressJson(
        new Request('http://localhost/test', {
          method: 'POST',
          body: '{}',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(LOGISTICS_ADDRESS_JSON_MAX_BYTES + 1)
          }
        })
      ),
    'INVALID_REQUEST'
  );

  const safeResponse = logisticsAddressErrorResponse(
    new Error('secret fixture at C:\\private\\address.json')
  );
  assert.equal(safeResponse.status, 503);
  const safeBody = JSON.stringify(await safeResponse.json());
  assert.match(safeBody, /ADDRESS_PROVIDER_UNAVAILABLE/);
  assert.doesNotMatch(safeBody, /secret|private|fixture|address\.json/i);
  assert.ok(LOGISTICS_ADDRESS_ERROR_CODES.includes('ADDRESS_PROVIDER_DISABLED'));

  console.log(
    `logisticsAddressProvider=PASS cities=${codes.length} errorCodes=${LOGISTICS_ADDRESS_ERROR_CODES.length}`
  );
}

void main();
