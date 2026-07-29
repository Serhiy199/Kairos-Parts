'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TbMapPin, TbPlus, TbTrash, TbTruckDelivery } from 'react-icons/tb';

import { KAIROS_LOGISTICS_BASE_ADDRESS } from '@/lib/logistics/constants';
import {
  calculateLogisticsPricePreview,
  formatLogisticsPrice,
  type LogisticsDestinationType
} from '@/lib/logistics/pricing-preview';
import {
  addLogisticsPickupPoint,
  createLogisticsPickupPoint,
  isLogisticsRequestDraftReady,
  LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH,
  LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
  LOGISTICS_CLIENT_COMMENT_MAX_LENGTH,
  LOGISTICS_CONTACT_NAME_MAX_LENGTH,
  LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH,
  LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH,
  LOGISTICS_SUPPLIER_NAME_MAX_LENGTH,
  LOGISTICS_SUPPLIER_NAME_MIN_LENGTH,
  removeLogisticsPickupPoint,
  parseLogisticsTariffCitySelection,
  transitionLogisticsDestination,
  type LogisticsPickupPointDraft
} from '@/lib/logistics/request-form-state';
import {
  LOGISTICS_TARIFF_CITIES,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import { formatPhoneIdentifierInput } from '@/lib/phone/client-format';

type LogisticsRequestFormProps = {
  initialContact: {
    name: string;
    phone: string;
  };
  submitEnabled: boolean;
};

type ServerQuote = {
  tariffCityCode: LogisticsTariffCityCode;
  tariffCityName: string;
  pickupPointCount: number;
  additionalPickupCount: number;
  destinationType: LogisticsDestinationType;
  baseTariff: string;
  additionalPointsCharge: string;
  farmDeliveryCharge: string;
  totalPrice: string;
  vatIncluded: true;
};

type CreatedRequest = {
  requestNumber: string;
  totalPrice: string;
  currency: 'UAH';
  vatIncluded: true;
  status: 'NEW';
};

type ApiError = {
  code: string;
  message: string;
  field?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readApiError(value: unknown): ApiError | null {
  if (
    !isRecord(value) ||
    !isRecord(value.error) ||
    typeof value.error.code !== 'string' ||
    typeof value.error.message !== 'string'
  ) {
    return null;
  }

  return {
    code: value.error.code,
    message: value.error.message,
    field: typeof value.error.field === 'string' ? value.error.field : undefined
  };
}

function readServerQuote(value: unknown): ServerQuote | null {
  if (!isRecord(value) || !isRecord(value.quote)) return null;
  const quote = value.quote;
  if (
    typeof quote.tariffCityCode !== 'string' ||
    typeof quote.tariffCityName !== 'string' ||
    typeof quote.pickupPointCount !== 'number' ||
    typeof quote.additionalPickupCount !== 'number' ||
    (quote.destinationType !== 'KAIROS_BASE' && quote.destinationType !== 'FARM') ||
    typeof quote.baseTariff !== 'string' ||
    typeof quote.additionalPointsCharge !== 'string' ||
    typeof quote.farmDeliveryCharge !== 'string' ||
    typeof quote.totalPrice !== 'string' ||
    quote.vatIncluded !== true
  ) {
    return null;
  }

  return quote as ServerQuote;
}

function readCreatedRequest(value: unknown): CreatedRequest | null {
  if (!isRecord(value) || !isRecord(value.request)) return null;
  const request = value.request;
  if (
    typeof request.requestNumber !== 'string' ||
    typeof request.totalPrice !== 'string' ||
    request.currency !== 'UAH' ||
    request.vatIncluded !== true ||
    request.status !== 'NEW'
  ) {
    return null;
  }

  return request as CreatedRequest;
}

function formatServerMoney(value: string) {
  const [whole = '0', fraction = '00'] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${grouped},${fraction.padEnd(2, '0').slice(0, 2)}\u00a0грн`;
}

export function LogisticsRequestForm({
  initialContact,
  submitEnabled
}: LogisticsRequestFormProps) {
  const pointCounterRef = useRef(1);
  const addPointButtonRef = useRef<HTMLButtonElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [tariffCityCode, setTariffCityCode] = useState<
    LogisticsTariffCityCode | null
  >(null);
  const [pickupPoints, setPickupPoints] = useState<LogisticsPickupPointDraft[]>([
    createLogisticsPickupPoint('pickup-1')
  ]);
  const [destinationType, setDestinationType] =
    useState<LogisticsDestinationType>('KAIROS_BASE');
  const [farmAddress, setFarmAddress] = useState('');
  const [contactName, setContactName] = useState(initialContact.name);
  const [contactPhone, setContactPhone] = useState(
    formatPhoneIdentifierInput(initialContact.phone).display
  );
  const [clientComment, setClientComment] = useState('');
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [serverQuote, setServerQuote] = useState<{
    key: string;
    value: ServerQuote;
  } | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<
    'idle' | 'loading' | 'verified' | 'error'
  >('idle');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});
  const [createdRequest, setCreatedRequest] = useState<CreatedRequest | null>(
    null
  );

  const preview = useMemo(
    () =>
      tariffCityCode
        ? calculateLogisticsPricePreview(
            tariffCityCode,
            pickupPoints.length,
            destinationType
          )
        : null,
    [destinationType, pickupPoints.length, tariffCityCode]
  );
  const isReady = isLogisticsRequestDraftReady({
    tariffCityCode,
    pickupPoints,
    destinationType,
    farmAddress,
    contactName,
    contactPhone,
    clientComment
  });
  const parsedPhone = formatPhoneIdentifierInput(contactPhone);
  const quoteKey = tariffCityCode
    ? `${tariffCityCode}:${pickupPoints.length}:${destinationType}`
    : '';
  const verifiedQuote =
    serverQuote?.key === quoteKey ? serverQuote.value : null;
  const canSubmit =
    submitEnabled &&
    isReady &&
    quoteStatus === 'verified' &&
    Boolean(verifiedQuote) &&
    Boolean(idempotencyKey) &&
    !isSubmitting;

  useEffect(() => {
    if (!tariffCityCode || pickupPoints.length < 1) {
      setServerQuote(null);
      setQuoteStatus('idle');
      setQuoteMessage('');
      return;
    }

    const controller = new AbortController();
    setQuoteStatus('loading');
    setQuoteMessage('Перевіряємо актуальний тариф…');
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/logistics/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tariffCityCode,
            pickupPointCount: pickupPoints.length,
            destinationType
          }),
          signal: controller.signal
        });
        const payload: unknown = await response.json();
        const quote = readServerQuote(payload);

        if (!response.ok || !quote) {
          setServerQuote(null);
          setQuoteStatus('error');
          setQuoteMessage(
            readApiError(payload)?.message ??
              'Не вдалося перевірити тариф. Спробуйте ще раз.'
          );
          return;
        }

        setServerQuote({ key: quoteKey, value: quote });
        setQuoteStatus('verified');
        setQuoteMessage('Тариф перевірено сервером.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setServerQuote(null);
        setQuoteStatus('error');
        setQuoteMessage('Не вдалося перевірити тариф. Спробуйте ще раз.');
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [destinationType, pickupPoints.length, quoteKey, tariffCityCode]);

  useEffect(() => {
    if (createdRequest) {
      successHeadingRef.current?.focus();
    }
  }, [createdRequest]);

  function touch(field: string) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function handleCityChange(nextCode: string) {
    setTariffCityCode(parseLogisticsTariffCitySelection(nextCode));
  }

  function updatePickupPoint(
    pointId: string,
    update: Partial<
      Pick<
        LogisticsPickupPointDraft,
        'supplierName' | 'address' | 'cargoDescription'
      >
    >
  ) {
    setPickupPoints((current) =>
      current.map((point) => (point.id === pointId ? { ...point, ...update } : point))
    );
  }

  function addPickupPoint() {
    pointCounterRef.current += 1;
    const point = createLogisticsPickupPoint(`pickup-${pointCounterRef.current}`);
    setPickupPoints((current) => addLogisticsPickupPoint(current, point));
    window.setTimeout(() => {
      document.getElementById(`supplier-name-${point.id}`)?.focus();
    }, 0);
  }

  function removePickupPoint(pointId: string) {
    setPickupPoints((current) => removeLogisticsPickupPoint(current, pointId));
    window.setTimeout(() => addPointButtonRef.current?.focus(), 0);
  }

  function selectDestination(nextDestination: LogisticsDestinationType) {
    const transition = transitionLogisticsDestination(
      nextDestination,
      farmAddress
    );
    setDestinationType(transition.destinationType);
    setFarmAddress(transition.farmAddress);
  }

  function handlePhoneChange(value: string) {
    const formatted = formatPhoneIdentifierInput(value);
    setContactPhone(formatted.isPhoneLike ? formatted.display : value);
  }

  function focusServerError(field: string | undefined) {
    window.setTimeout(() => {
      if (field?.startsWith('pickupPoints.')) {
        const [, rawIndex, property] = field.split('.');
        const index = Number(rawIndex);
        const point = pickupPoints[index];
        if (point) {
          const fieldId =
            property === 'supplierName'
              ? `supplier-name-${point.id}`
              : property === 'cargoDescription'
                ? `cargo-description-${point.id}`
                : `pickup-address-${point.id}`;
          document.getElementById(fieldId)?.focus();
          return;
        }
      }
      const fieldIds: Record<string, string> = {
        tariffCityCode: 'logistics-tariff-city',
        farmAddress: 'logistics-farm-address',
        contactName: 'logistics-contact-name',
        contactPhone: 'logistics-contact-phone'
      };
      const elementId = field ? fieldIds[field] : undefined;
      if (elementId) {
        document.getElementById(elementId)?.focus();
        return;
      }
      errorSummaryRef.current?.focus();
    }, 0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !tariffCityCode || !parsedPhone.canonical) return;

    setIsSubmitting(true);
    setGlobalError('');
    setServerFieldErrors({});

    try {
      const response = await fetch('/api/logistics/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          honeypot,
          tariffCityCode,
          pickupPoints: pickupPoints.map((point) => ({
            supplierName: point.supplierName,
            address: point.address,
            cargoDescription: point.cargoDescription
          })),
          destinationType,
          farmAddress: destinationType === 'FARM' ? farmAddress : undefined,
          contactName,
          contactPhone: parsedPhone.canonical,
          clientComment
        })
      });
      const payload: unknown = await response.json();
      const created = readCreatedRequest(payload);

      if (!response.ok || !created) {
        const error = readApiError(payload);
        const message =
          error?.message ?? 'Не вдалося створити заявку. Спробуйте ще раз.';
        setGlobalError(message);
        if (error?.field) {
          setServerFieldErrors({ [error.field]: message });
        }
        focusServerError(error?.field);
        return;
      }

      setCreatedRequest(created);
    } catch {
      setGlobalError(
        'З’єднання перервано. Повторіть надсилання — дубль не буде створено.'
      );
      errorSummaryRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdRequest) {
    return (
      <section
        aria-labelledby="logistics-success-title"
        className="public-card mx-auto max-w-3xl p-6 text-center sm:p-10"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-public-success">
          Kairos Logistics
        </p>
        <h2
          ref={successHeadingRef}
          id="logistics-success-title"
          tabIndex={-1}
          className="mt-3 font-display text-3xl font-bold text-public-primary focus:outline-none sm:text-4xl"
        >
          Заявку створено
        </h2>
        <dl className="mx-auto mt-7 grid max-w-xl gap-3 rounded-xl border border-public-border bg-public-elevated p-5 text-left sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-public-muted">
              Номер заявки
            </dt>
            <dd className="mt-1 break-words text-xl font-bold text-public-primary">
              {createdRequest.requestNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-public-muted">
              Остаточна сума
            </dt>
            <dd className="mt-1 break-words text-xl font-bold text-accent">
              {formatServerMoney(createdRequest.totalPrice)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-public-muted">
              Статус
            </dt>
            <dd className="mt-1 font-bold text-public-success">Нова заявка</dd>
          </div>
        </dl>
        <p className="mx-auto mt-6 max-w-xl leading-7 text-public-secondary">
          Представник Kairos зв’яжеться з вами за вказаним номером телефону.
        </p>
        <Link
          href="/logistics"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Повернутися до сторінки логістики
        </Link>
      </section>
    );
  }

  return (
    <form
      aria-label="Форма заявки Kairos Logistics"
      onSubmit={handleSubmit}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.42fr)] lg:items-start"
    >
      <label className="absolute -left-[10000px] h-px w-px overflow-hidden">
        Вебсайт
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </label>
      <div className="grid min-w-0 gap-6">
        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            1. Місто відвантаження
          </legend>
          <label
            htmlFor="logistics-tariff-city"
            className="mt-4 grid gap-2 text-sm font-semibold text-public-secondary"
          >
            Місто відвантаження <span aria-hidden="true">*</span>
            <select
              id="logistics-tariff-city"
              value={tariffCityCode ?? ''}
              required
              onChange={(event) => handleCityChange(event.target.value)}
              className="public-field min-h-11 w-full"
            >
              <option value="">Оберіть місто</option>
              {LOGISTICS_TARIFF_CITIES.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.displayName}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-public-muted">
            Усі точки відвантаження мають знаходитися в межах вибраного тарифного
            міста.
          </p>
        </fieldset>

        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            2. Точки відвантаження
          </legend>
          <div className="mt-4 grid gap-5">
            {pickupPoints.map((point, index) => {
              const supplierField = `supplier-${point.id}`;
              const supplierLength = point.supplierName.trim().length;
              const supplierError =
                serverFieldErrors[`pickupPoints.${index}.supplierName`] ||
                (touchedFields[supplierField] &&
                (supplierLength < LOGISTICS_SUPPLIER_NAME_MIN_LENGTH ||
                  supplierLength > LOGISTICS_SUPPLIER_NAME_MAX_LENGTH)
                  ? 'Вкажіть назву компанії або постачальника.'
                  : '');
              const addressField = `address-${point.id}`;
              const addressLength = point.address.trim().length;
              const addressError =
                serverFieldErrors[`pickupPoints.${index}.address`] ||
                (touchedFields[addressField] &&
                (addressLength < LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH ||
                  addressLength > LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH)
                  ? 'Вкажіть повну адресу завантаження.'
                  : '');
              const cargoField = `cargo-${point.id}`;
              const cargoLength = point.cargoDescription.trim().length;
              const cargoError =
                serverFieldErrors[`pickupPoints.${index}.cargoDescription`] ||
                (touchedFields[cargoField] &&
                (cargoLength < LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH ||
                  cargoLength > LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH)
                  ? 'Опишіть, що потрібно забрати.'
                  : '');

              return (
                <article
                  key={point.id}
                  className="min-w-0 rounded-xl border border-public-border bg-public-elevated p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-public-primary">
                      Точка відвантаження {index + 1}
                    </h2>
                    {index > 0 ? (
                      <button
                        type="button"
                        aria-label={`Видалити точку відвантаження ${index + 1}`}
                        onClick={() => removePickupPoint(point.id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-public-border px-3 py-2 text-sm font-semibold text-public-secondary transition hover:border-public-border-accent-hover hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <TbTrash aria-hidden="true" className="size-4" />
                        Видалити
                      </button>
                    ) : null}
                  </div>

                  <label
                    htmlFor={`supplier-name-${point.id}`}
                    className="mt-5 grid gap-2 text-sm font-semibold text-public-secondary"
                  >
                    Назва компанії / постачальника{' '}
                    <span aria-hidden="true">*</span>
                    <input
                      id={`supplier-name-${point.id}`}
                      type="text"
                      value={point.supplierName}
                      required
                      minLength={LOGISTICS_SUPPLIER_NAME_MIN_LENGTH}
                      maxLength={LOGISTICS_SUPPLIER_NAME_MAX_LENGTH}
                      placeholder="ТОВ «Агро-Тех»"
                      aria-invalid={Boolean(supplierError)}
                      aria-describedby={
                        supplierError ? `${supplierField}-error` : undefined
                      }
                      onChange={(event) =>
                        updatePickupPoint(point.id, {
                          supplierName: event.target.value
                        })
                      }
                      onBlur={() => touch(supplierField)}
                      className="public-field min-h-11 w-full"
                    />
                  </label>
                  {supplierError ? (
                    <p
                      id={`${supplierField}-error`}
                      className="mt-2 text-xs font-semibold text-public-danger"
                    >
                      {supplierError}
                    </p>
                  ) : null}

                  <label
                    htmlFor={`pickup-address-${point.id}`}
                    className="mt-5 grid gap-2 text-sm font-semibold text-public-secondary"
                  >
                    Повна адреса завантаження <span aria-hidden="true">*</span>
                    <input
                      id={`pickup-address-${point.id}`}
                      type="text"
                      value={point.address}
                      required
                      minLength={LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH}
                      maxLength={LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH}
                      placeholder="м. Біла Церква, вул. Київська, 25, склад №3"
                      aria-invalid={Boolean(addressError)}
                      aria-describedby={
                        addressError ? `${addressField}-error` : undefined
                      }
                      onChange={(event) =>
                        updatePickupPoint(point.id, {
                          address: event.target.value
                        })
                      }
                      onBlur={() => touch(addressField)}
                      className="public-field min-h-11 w-full"
                    />
                  </label>
                  {addressError ? (
                    <p
                      id={`${addressField}-error`}
                      className="mt-2 text-xs font-semibold text-public-danger"
                    >
                      {addressError}
                    </p>
                  ) : null}

                  <label
                    htmlFor={`cargo-description-${point.id}`}
                    className="mt-5 grid gap-2 text-sm font-semibold text-public-secondary"
                  >
                    Опис вантажу <span aria-hidden="true">*</span>
                    <textarea
                      id={`cargo-description-${point.id}`}
                      value={point.cargoDescription}
                      required
                      minLength={LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH}
                      maxLength={LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH}
                      rows={4}
                      aria-invalid={Boolean(cargoError)}
                      aria-describedby={`${cargoField}-helper ${
                        cargoError ? `${cargoField}-error` : ''
                      }`.trim()}
                      onChange={(event) =>
                        updatePickupPoint(point.id, {
                          cargoDescription: event.target.value
                        })
                      }
                      onBlur={() => touch(cargoField)}
                      className="public-field min-h-28 w-full resize-y"
                    />
                  </label>
                  <p
                    id={`${cargoField}-helper`}
                    className="mt-2 text-xs leading-5 text-public-muted"
                  >
                    Наприклад: запчастини, насіння, комплектуючі або номер рахунку.
                  </p>
                  {cargoError ? (
                    <p
                      id={`${cargoField}-error`}
                      className="mt-2 text-xs font-semibold text-public-danger"
                    >
                      {cargoError}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <button
            ref={addPointButtonRef}
            type="button"
            onClick={addPickupPoint}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-accent/50 px-4 py-3 text-sm font-bold text-public-primary transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
          >
            <TbPlus aria-hidden="true" className="size-5" />
            Додати ще одну точку
          </button>
        </fieldset>

        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            3. Куди доставити товар?
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DestinationRadio
              value="KAIROS_BASE"
              checked={destinationType === 'KAIROS_BASE'}
              title="Доставити на базу Kairos"
              description="Без додаткової доплати"
              onChange={selectDestination}
            />
            <DestinationRadio
              value="FARM"
              checked={destinationType === 'FARM'}
              title="Доставити в господарство"
              description="+500 грн, ПДВ включено"
              onChange={selectDestination}
            />
          </div>

          {destinationType === 'KAIROS_BASE' ? (
            <div className="mt-5 rounded-lg border border-public-border bg-public-elevated p-4">
              <p className="flex items-start gap-2 font-semibold text-public-primary">
                <TbMapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
                {KAIROS_LOGISTICS_BASE_ADDRESS}
              </p>
              <p className="mt-2 text-sm leading-6 text-public-muted">
                Доставка до бази входить у розрахунок без додаткової доплати.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <label
                htmlFor="logistics-farm-address"
                className="grid gap-2 text-sm font-semibold text-public-secondary"
              >
                Повна адреса господарства <span aria-hidden="true">*</span>
                <input
                  id="logistics-farm-address"
                  type="text"
                  value={farmAddress}
                  required
                  minLength={LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH}
                  maxLength={LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH}
                  placeholder="Область, район, населений пункт, вулиця, будинок"
                  aria-invalid={Boolean(serverFieldErrors.farmAddress)}
                  aria-describedby={
                    serverFieldErrors.farmAddress
                      ? 'logistics-farm-address-error'
                      : 'logistics-farm-address-helper'
                  }
                  onChange={(event) => setFarmAddress(event.target.value)}
                  className="public-field min-h-11 w-full"
                />
              </label>
              <p
                id="logistics-farm-address-helper"
                className="mt-2 text-xs leading-5 text-public-muted"
              >
                Доставка в господарство доступна в межах Кагарлицької громади.
              </p>
              {serverFieldErrors.farmAddress ? (
                <p
                  id="logistics-farm-address-error"
                  className="mt-2 text-xs font-semibold text-public-danger"
                >
                  {serverFieldErrors.farmAddress}
                </p>
              ) : null}
            </div>
          )}
        </fieldset>

        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            4. Контактні дані
          </legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-public-secondary">
              Ім’я <span aria-hidden="true">*</span>
              <input
                id="logistics-contact-name"
                type="text"
                value={contactName}
                required
                maxLength={LOGISTICS_CONTACT_NAME_MAX_LENGTH}
                autoComplete="name"
                onChange={(event) => setContactName(event.target.value)}
                onBlur={() => touch('contactName')}
                aria-invalid={
                  touchedFields.contactName && !contactName.trim() ? true : undefined
                }
                aria-describedby={
                  touchedFields.contactName && !contactName.trim()
                    ? 'logistics-contact-name-error'
                    : undefined
                }
                className="public-field min-h-11 w-full"
              />
              {touchedFields.contactName && !contactName.trim() ? (
                <span
                  id="logistics-contact-name-error"
                  className="text-xs font-semibold text-public-danger"
                >
                  Вкажіть контактне ім’я.
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-semibold text-public-secondary">
              Номер телефону <span aria-hidden="true">*</span>
              <input
                id="logistics-contact-phone"
                type="tel"
                inputMode="tel"
                value={contactPhone}
                required
                autoComplete="tel"
                placeholder="+38 (0__) ___-__-__"
                onChange={(event) => handlePhoneChange(event.target.value)}
                onBlur={() => touch('contactPhone')}
                aria-invalid={
                  touchedFields.contactPhone && !parsedPhone.canonical
                    ? true
                    : undefined
                }
                aria-describedby={
                  touchedFields.contactPhone && !parsedPhone.canonical
                    ? 'logistics-contact-phone-error'
                    : undefined
                }
                className="public-field min-h-11 w-full"
              />
              {touchedFields.contactPhone && !parsedPhone.canonical ? (
                <span
                  id="logistics-contact-phone-error"
                  className="text-xs font-semibold text-public-danger"
                >
                  Введіть український номер у форматі +380XXXXXXXXX.
                </span>
              ) : null}
            </label>
          </div>
        </fieldset>

        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            5. Коментар
          </legend>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-public-secondary">
            Коментар до заявки
            <textarea
              value={clientComment}
              maxLength={LOGISTICS_CLIENT_COMMENT_MAX_LENGTH}
              rows={5}
              onChange={(event) => setClientComment(event.target.value)}
              className="public-field min-h-32 w-full resize-y"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-public-muted">
            Додайте важливі деталі щодо завантаження або перевезення.
          </p>
        </fieldset>
      </div>

      <aside
        aria-labelledby="logistics-price-preview-title"
        className="public-card min-w-0 p-5 sm:p-7 lg:sticky lg:top-24"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          Серверний тариф
        </p>
        <h2
          id="logistics-price-preview-title"
          className="mt-2 text-2xl font-bold text-public-primary"
        >
          Розрахунок вартості
        </h2>
        <p className="mt-3 text-sm leading-6 text-public-muted">
          Сума розрахована за чинними початковими тарифами. Під час надсилання
          заявки сервер повторно перевірятиме актуальний тариф.
        </p>

        {verifiedQuote ? (
          <dl className="mt-6 grid gap-3 text-sm">
            <PriceRow
              label={`Базовий тариф — ${verifiedQuote.tariffCityName}`}
              value={formatServerMoney(verifiedQuote.baseTariff)}
            />
            <PriceRow
              label={`Додаткові точки: ${verifiedQuote.additionalPickupCount} × 500`}
              value={formatServerMoney(verifiedQuote.additionalPointsCharge)}
            />
            <PriceRow
              label="Доставка в господарство"
              value={formatServerMoney(verifiedQuote.farmDeliveryCharge)}
            />
            <div className="mt-2 flex items-start justify-between gap-4 border-t border-public-border pt-4">
              <dt className="font-bold text-public-primary">Загальна вартість</dt>
              <dd className="shrink-0 text-xl font-bold text-accent">
                {formatServerMoney(verifiedQuote.totalPrice)}
              </dd>
            </div>
          </dl>
        ) : preview ? (
          <dl className="mt-6 grid gap-3 text-sm">
            <PriceRow
              label={`Базовий тариф — ${preview.cityName}`}
              value={formatLogisticsPrice(preview.baseTariffMinorUnits)}
            />
            <PriceRow
              label={`Додаткові точки: ${preview.additionalPointCount} × 500`}
              value={formatLogisticsPrice(preview.additionalPointsMinorUnits)}
            />
            <PriceRow
              label="Доставка в господарство"
              value={formatLogisticsPrice(preview.farmDeliveryMinorUnits)}
            />
            <div className="mt-2 flex items-start justify-between gap-4 border-t border-public-border pt-4">
              <dt className="font-bold text-public-primary">Загальна вартість</dt>
              <dd className="shrink-0 text-xl font-bold text-accent">
                {formatLogisticsPrice(preview.totalMinorUnits)}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-public-border p-4 text-sm leading-6 text-public-muted">
            Оберіть тарифне місто, щоб побачити розрахунок.
          </div>
        )}

        <p className="mt-5 text-sm font-semibold text-public-primary">
          Усі ціни включають ПДВ.
        </p>
        <p
          aria-live="polite"
          className={`mt-3 min-h-5 text-sm font-semibold ${
            quoteStatus === 'verified'
              ? 'text-public-success'
              : quoteStatus === 'error'
                ? 'text-public-danger'
                : 'text-public-muted'
          }`}
        >
          {quoteMessage}
        </p>
        <div
          aria-live="polite"
          className={`mt-6 rounded-lg border p-4 text-sm font-semibold ${
            isReady && verifiedQuote
              ? 'border-public-success/30 bg-public-success/10 text-public-success'
              : 'border-public-border bg-public-elevated text-public-muted'
          }`}
        >
          {isReady && verifiedQuote
            ? 'Дані форми заповнено, тариф актуальний.'
            : 'Заповніть усі обов’язкові поля.'}
        </div>

        {globalError ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            className="mt-5 rounded-lg border border-public-danger/30 bg-public-danger/10 p-4 text-sm font-semibold text-public-danger focus:outline-none"
          >
            {globalError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          aria-describedby="logistics-submit-helper"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <TbTruckDelivery aria-hidden="true" className="size-5" />
          {isSubmitting
            ? 'Створюємо заявку…'
            : 'Створити заявку на перевезення'}
        </button>
        <p aria-live="polite" className="sr-only">
          {isSubmitting ? 'Заявка створюється.' : ''}
        </p>
        <p
          id="logistics-submit-helper"
          className="mt-3 text-center text-xs leading-5 text-public-muted"
        >
          {submitEnabled
            ? 'Сервер нормалізує адреси та повторно перевірить тариф і остаточну суму.'
            : 'Надсилання заявок вимкнено конфігурацією середовища.'}
        </p>
      </aside>
    </form>
  );
}

function DestinationRadio({
  value,
  checked,
  title,
  description,
  onChange
}: {
  value: LogisticsDestinationType;
  checked: boolean;
  title: string;
  description: string;
  onChange: (value: LogisticsDestinationType) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border p-4 transition ${
        checked
          ? 'border-accent bg-accent/10'
          : 'border-public-border bg-public-elevated hover:border-public-border-accent-hover'
      }`}
    >
      <span className="flex items-start gap-3">
        <input
          type="radio"
          name="destinationType"
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="mt-1 accent-accent"
        />
        <span>
          <span className="block font-bold text-public-primary">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-public-muted">
            {description}
          </span>
        </span>
      </span>
    </label>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-public-muted">{label}</dt>
      <dd className="shrink-0 font-semibold text-public-primary">{value}</dd>
    </div>
  );
}
