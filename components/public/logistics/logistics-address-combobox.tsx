'use client';

import { useEffect, useId, useRef, useState } from 'react';

import type {
  LogisticsAddressErrorCode
} from '@/lib/logistics/address-provider/errors';
import { LOGISTICS_ADDRESS_ERROR_CODES } from '@/lib/logistics/address-provider/errors';
import type {
  LogisticsAddressScope,
  LogisticsAddressSuggestion,
  LogisticsResolvedAddress
} from '@/lib/logistics/address-provider/contracts';
import { LOGISTICS_ADDRESS_QUERY_MIN_LENGTH } from '@/lib/logistics/address-provider/validation';

type LogisticsAddressComboboxProps = {
  label: string;
  scope: LogisticsAddressScope | null;
  value: LogisticsResolvedAddress | null;
  onResolvedChange: (address: LogisticsResolvedAddress | null) => void;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  clearSignal?: number;
};

const ERROR_MESSAGES: Partial<Record<LogisticsAddressErrorCode, string>> = {
  QUERY_TOO_SHORT: 'Введіть щонайменше 3 символи.',
  QUERY_TOO_LONG: 'Адреса для пошуку занадто довга.',
  UNKNOWN_TARIFF_CITY: 'Оберіть доступне тарифне місто.',
  ADDRESS_NOT_FOUND: 'За цією адресою нічого не знайдено.',
  ADDRESS_SCOPE_MISMATCH: 'Оберіть адресу у визначеній зоні доставки.',
  ADDRESS_PROVIDER_DISABLED: 'Пошук адрес зараз недоступний.',
  ADDRESS_PROVIDER_UNAVAILABLE: 'Пошук адрес тимчасово недоступний.',
  INVALID_ADDRESS_SCOPE: 'Не вдалося визначити область пошуку адреси.',
  INVALID_REQUEST: 'Не вдалося виконати пошук. Перевірте введені дані.'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAddressErrorCode(value: unknown): value is LogisticsAddressErrorCode {
  return (
    typeof value === 'string' &&
    LOGISTICS_ADDRESS_ERROR_CODES.some((code) => code === value)
  );
}

function readAddressErrorCode(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }

  return isAddressErrorCode(payload.error.code) ? payload.error.code : undefined;
}

function isAddressSuggestion(value: unknown): value is LogisticsAddressSuggestion {
  return (
    isRecord(value) &&
    typeof value.externalAddressId === 'string' &&
    typeof value.formattedAddress === 'string' &&
    typeof value.normalizedLocality === 'string' &&
    (value.normalizedAdministrativeArea === undefined ||
      typeof value.normalizedAdministrativeArea === 'string') &&
    (value.addressProvider === 'MOCK' || value.addressProvider === 'GOOGLE')
  );
}

function readAddressSuggestions(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.suggestions)) {
    return [];
  }

  return payload.suggestions.filter(isAddressSuggestion);
}

function readResolvedAddress(payload: unknown) {
  if (!isRecord(payload) || !isAddressSuggestion(payload.address)) {
    return null;
  }

  return payload.address;
}

function addressErrorMessage(code: LogisticsAddressErrorCode | undefined) {
  return code ? ERROR_MESSAGES[code] ?? 'Не вдалося підтвердити адресу. Спробуйте ще раз.' : 'Не вдалося підтвердити адресу. Спробуйте ще раз.';
}

export function LogisticsAddressCombobox({
  label,
  scope,
  value,
  onResolvedChange,
  disabled = false,
  required = false,
  helperText,
  clearSignal = 0
}: LogisticsAddressComboboxProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const helperId = `${generatedId}-helper`;
  const statusId = `${generatedId}-status`;
  const [query, setQuery] = useState(value?.formattedAddress ?? '');
  const [suggestions, setSuggestions] = useState<LogisticsAddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [message, setMessage] = useState('');
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const scopeType = scope?.type ?? null;
  const tariffCityCode =
    scope?.type === 'TARIFF_CITY' ? scope.tariffCityCode : null;
  const isDisabled = disabled || scopeType === null;
  const activeSuggestion = suggestions[activeIndex];
  const activeOptionId = activeSuggestion
    ? `${listboxId}-option-${activeIndex}`
    : undefined;
  const isOpen =
    isFocused &&
    !isDisabled &&
    !value &&
    suggestions.length > 0;

  useEffect(() => {
    setQuery('');
    setSuggestions([]);
    setActiveIndex(0);
    setMessage('');
    autocompleteAbortRef.current?.abort();
    resolveAbortRef.current?.abort();
  }, [clearSignal]);

  useEffect(() => {
    if (value) {
      setQuery(value.formattedAddress);
      setSuggestions([]);
      setMessage('Адресу підтверджено.');
    }
  }, [value]);

  useEffect(() => {
    autocompleteAbortRef.current?.abort();

    const trimmedQuery = query.trim();
    if (isDisabled || value || isResolving) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (trimmedQuery.length < LOGISTICS_ADDRESS_QUERY_MIN_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setMessage(
        trimmedQuery.length > 0
          ? `Введіть щонайменше ${LOGISTICS_ADDRESS_QUERY_MIN_LENGTH} символи.`
          : ''
      );
      return;
    }

    const controller = new AbortController();
    autocompleteAbortRef.current = controller;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setMessage('Шукаємо адреси…');

      try {
        const requestScope: LogisticsAddressScope | null =
          scopeType === 'TARIFF_CITY' && tariffCityCode
            ? { type: 'TARIFF_CITY', tariffCityCode }
            : scopeType === 'KAHARLYK_COMMUNITY'
              ? { type: 'KAHARLYK_COMMUNITY' }
              : null;
        if (!requestScope) {
          setSuggestions([]);
          setIsLoading(false);
          return;
        }
        const response = await fetch('/api/logistics/addresses/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmedQuery, scope: requestScope }),
          signal: controller.signal
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          setSuggestions([]);
          setMessage(addressErrorMessage(readAddressErrorCode(payload)));
          return;
        }

        const nextSuggestions = readAddressSuggestions(payload);
        setSuggestions(nextSuggestions);
        setActiveIndex(0);
        setMessage(
          nextSuggestions.length > 0
            ? `Знайдено адрес: ${nextSuggestions.length}.`
            : 'За цією адресою нічого не знайдено.'
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setSuggestions([]);
        setMessage('Пошук адрес тимчасово недоступний.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isDisabled, isResolving, query, scopeType, tariffCityCode, value]);

  useEffect(
    () => () => {
      autocompleteAbortRef.current?.abort();
      resolveAbortRef.current?.abort();
    },
    []
  );

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setSuggestions([]);
    setActiveIndex(0);
    setMessage('');

    if (value) {
      onResolvedChange(null);
    }
  }

  async function resolveSuggestion(suggestion: LogisticsAddressSuggestion) {
    autocompleteAbortRef.current?.abort();
    resolveAbortRef.current?.abort();

    const controller = new AbortController();
    resolveAbortRef.current = controller;
    setIsResolving(true);
    setSuggestions([]);
    setQuery(suggestion.formattedAddress);
    setMessage('Підтверджуємо адресу…');

    try {
      const requestScope: LogisticsAddressScope | null =
        scopeType === 'TARIFF_CITY' && tariffCityCode
          ? { type: 'TARIFF_CITY', tariffCityCode }
          : scopeType === 'KAHARLYK_COMMUNITY'
            ? { type: 'KAHARLYK_COMMUNITY' }
            : null;
      if (!requestScope) {
        onResolvedChange(null);
        setMessage('Спочатку оберіть тарифне місто.');
        setIsResolving(false);
        return;
      }
      const response = await fetch('/api/logistics/addresses/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalAddressId: suggestion.externalAddressId,
          scope: requestScope
        }),
        signal: controller.signal
      });
      const payload: unknown = await response.json();
      const resolvedAddress = readResolvedAddress(payload);

      if (!response.ok || !resolvedAddress) {
        onResolvedChange(null);
        setMessage(addressErrorMessage(readAddressErrorCode(payload)));
        return;
      }

      onResolvedChange(resolvedAddress);
      setQuery(resolvedAddress.formattedAddress);
      setMessage('Адресу підтверджено.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      onResolvedChange(null);
      setMessage('Не вдалося підтвердити адресу. Спробуйте ще раз.');
    } finally {
      if (!controller.signal.aborted) {
        setIsResolving(false);
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && activeSuggestion) {
      event.preventDefault();
      void resolveSuggestion(activeSuggestion);
      return;
    }

    if (event.key === 'Escape') {
      setSuggestions([]);
      setMessage('');
      setIsFocused(false);
    }
  }

  return (
    <div className="relative grid gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-public-secondary">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        type="text"
        value={query}
        disabled={isDisabled}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-describedby={`${helperText ? helperId : ''} ${statusId}`.trim()}
        aria-invalid={Boolean(query.trim() && !value && !isLoading && !isResolving)}
        placeholder={isDisabled ? 'Спочатку оберіть тарифне місто' : 'Почніть вводити адресу'}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 100)}
        className="public-field min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-60"
      />
      {helperText ? (
        <p id={helperId} className="text-xs leading-5 text-public-muted">
          {helperText}
        </p>
      ) : null}
      <p
        id={statusId}
        aria-live="polite"
        className={`min-h-5 text-xs font-medium ${
          value ? 'text-public-success' : 'text-public-muted'
        }`}
      >
        {isResolving ? 'Підтверджуємо адресу…' : isLoading ? 'Шукаємо адреси…' : message}
      </p>

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[4.75rem] z-30 max-h-64 overflow-y-auto rounded-md border border-public-border bg-public-card py-1 shadow-panel"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.externalAddressId}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => {
                event.preventDefault();
                void resolveSuggestion(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-3 text-sm leading-5 ${
                activeIndex === index
                  ? 'bg-accent/15 text-public-primary'
                  : 'text-public-secondary hover:bg-public-elevated'
              }`}
            >
              {suggestion.formattedAddress}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
