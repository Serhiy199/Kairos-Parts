'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  TbAlertTriangle,
  TbBuildingWarehouse,
  TbCheck,
  TbCircleCheck,
  TbInfoCircle,
  TbMapPin,
  TbPlus,
  TbTractor,
  TbTrash,
  TbTruckDelivery
} from 'react-icons/tb';

import { KAIROS_LOGISTICS_BASE_ADDRESS } from '@/lib/logistics/constants';
import {
  compareDateOnly,
  formatDateOnlyShort,
  parseDateOnly
} from '@/lib/logistics/date-only';
import {
  ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS,
  calculateLogisticsPricePreview,
  FARM_DELIVERY_CHARGE_MINOR_UNITS,
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
  INDIVIDUAL_PRICING_SELECT_VALUE,
  LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH,
  LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH,
  normalizeLogisticsCustomLocality,
  type LogisticsPricingTypeValue
} from '@/lib/logistics/pricing-type';
import {
  LOGISTICS_TARIFF_CITIES,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import { formatPhoneIdentifierInput } from '@/lib/phone/client-format';
import { siteContacts } from '@/lib/site-contacts';

type LogisticsRequestFormProps = {
  initialContact: {
    name: string;
    phone: string;
  };
  minPreferredDeliveryDate: string;
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
  pricingType: LogisticsPricingTypeValue;
  totalPrice: string | null;
  currency: 'UAH';
  vatIncluded: true;
  status: 'NEW';
  preferredDeliveryDate: string;
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
    (request.pricingType !== 'FIXED' &&
      request.pricingType !== 'INDIVIDUAL') ||
    (request.totalPrice !== null &&
      typeof request.totalPrice !== 'string') ||
    request.currency !== 'UAH' ||
    request.vatIncluded !== true ||
    request.status !== 'NEW' ||
    typeof request.preferredDeliveryDate !== 'string'
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

const logisticsFieldClassName =
  'public-field min-h-[50px] w-full rounded-lg px-4 py-3 text-sm leading-6 transition hover:border-public-border-accent-hover aria-invalid:border-public-danger aria-invalid:focus:ring-public-danger/25 disabled:cursor-not-allowed disabled:bg-public-elevated disabled:text-public-muted autofill:shadow-[inset_0_0_0_1000px_var(--public-surface-elevated)] autofill:[-webkit-text-fill-color:var(--public-text-primary)]';
const logisticsTextareaClassName = `${logisticsFieldClassName} min-h-[128px] resize-y`;
const logisticsLabelClassName =
  'grid gap-2 text-sm font-semibold text-public-secondary';
const LOGISTICS_TRANSPORT_RESTRICTIONS = [
  'є вибухонебезпечними',
  'є легкозаймистими або горючими без належної упаковки',
  'містять хімічні речовини, що потребують спеціального дозволу',
  'потребують механізованого завантаження або розвантаження (кран, навантажувач тощо)',
  'є великогабаритними або негабаритними та перевищують можливості нашого транспорту',
  'є живими тваринами',
  'є готівковими коштами, цінними паперами або іншими цінностями'
] as const;

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{children}</span>
      <span aria-hidden="true" className="text-accent">
        *
      </span>
    </span>
  );
}

function SectionHeading({
  id,
  number,
  children
}: {
  id: string;
  number: number;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-baseline gap-3 text-xl font-bold text-public-primary"
    >
      <span className="text-accent">{number}.</span>
      <span>{children}</span>
    </h2>
  );
}

export function LogisticsRequestForm({
  initialContact,
  minPreferredDeliveryDate
}: LogisticsRequestFormProps) {
  const pointCounterRef = useRef(1);
  const addPointButtonRef = useRef<HTMLButtonElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [tariffCityCode, setTariffCityCode] = useState<
    LogisticsTariffCityCode | null
  >(null);
  const [pricingType, setPricingType] =
    useState<LogisticsPricingTypeValue>('FIXED');
  const [customLocality, setCustomLocality] = useState('');
  const [pickupPoints, setPickupPoints] = useState<LogisticsPickupPointDraft[]>([
    createLogisticsPickupPoint('pickup-1')
  ]);
  const [destinationType, setDestinationType] =
    useState<LogisticsDestinationType>('KAIROS_BASE');
  const [farmAddress, setFarmAddress] = useState('');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
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
      pricingType === 'FIXED' && tariffCityCode
        ? calculateLogisticsPricePreview(
            tariffCityCode,
            pickupPoints.length,
            destinationType
          )
        : null,
    [destinationType, pickupPoints.length, pricingType, tariffCityCode]
  );
  const isReady = isLogisticsRequestDraftReady(
    {
      pricingType,
      tariffCityCode,
      customLocality,
      pickupPoints,
      destinationType,
      farmAddress,
      preferredDeliveryDate,
      contactName,
      contactPhone,
      clientComment
    },
    minPreferredDeliveryDate
  );
  const parsedPreferredDeliveryDate = parseDateOnly(preferredDeliveryDate);
  const preferredDeliveryDateInvalid =
    Boolean(touchedFields.preferredDeliveryDate) &&
    (!parsedPreferredDeliveryDate ||
      compareDateOnly(
        parsedPreferredDeliveryDate.value,
        minPreferredDeliveryDate
      ) < 0);
  const parsedPhone = formatPhoneIdentifierInput(contactPhone);
  const quoteKey = pricingType === 'FIXED' && tariffCityCode
    ? `${tariffCityCode}:${pickupPoints.length}:${destinationType}`
    : '';
  const verifiedQuote =
    serverQuote?.key === quoteKey ? serverQuote.value : null;
  const canSubmit =
    isReady &&
    (pricingType === 'INDIVIDUAL' ||
      (quoteStatus === 'verified' && Boolean(verifiedQuote))) &&
    Boolean(idempotencyKey) &&
    !isSubmitting;

  useEffect(() => {
    if (
      pricingType !== 'FIXED' ||
      !tariffCityCode ||
      pickupPoints.length < 1
    ) {
      setServerQuote(null);
      setQuoteStatus('idle');
      setQuoteMessage('');
      return;
    }

    const controller = new AbortController();
    setQuoteStatus('loading');
    setQuoteMessage('');
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
        setQuoteMessage('');
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
  }, [
    destinationType,
    pickupPoints.length,
    pricingType,
    quoteKey,
    tariffCityCode
  ]);

  useEffect(() => {
    if (createdRequest) {
      successHeadingRef.current?.focus();
    }
  }, [createdRequest]);

  function touch(field: string) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function clearServerFieldError(field: string) {
    setServerFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleCityChange(nextCode: string) {
    if (nextCode === INDIVIDUAL_PRICING_SELECT_VALUE) {
      setPricingType('INDIVIDUAL');
      setTariffCityCode(null);
      setServerQuote(null);
      setQuoteStatus('idle');
      setQuoteMessage('');
      clearServerFieldError('tariffCityCode');
      return;
    }

    setPricingType('FIXED');
    setCustomLocality('');
    setTariffCityCode(parseLogisticsTariffCitySelection(nextCode));
    clearServerFieldError('customLocality');
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
        pricingType: 'logistics-tariff-city',
        tariffCityCode: 'logistics-tariff-city',
        customLocality: 'logistics-custom-locality',
        farmAddress: 'logistics-farm-address',
        preferredDeliveryDate: 'logistics-preferred-delivery-date',
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
    if (
      !canSubmit ||
      (pricingType === 'FIXED' && !tariffCityCode) ||
      !parsedPhone.canonical
    ) {
      return;
    }

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
          pricingType,
          ...(pricingType === 'FIXED'
            ? { tariffCityCode }
            : {
                customLocality:
                  normalizeLogisticsCustomLocality(customLocality)
              }),
          pickupPoints: pickupPoints.map((point) => ({
            supplierName: point.supplierName,
            address: point.address,
            cargoDescription: point.cargoDescription
          })),
          destinationType,
          farmAddress: destinationType === 'FARM' ? farmAddress : undefined,
          preferredDeliveryDate,
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
        className="public-card mx-auto max-w-4xl p-6 text-center sm:p-9"
      >
        <TbCircleCheck
          aria-hidden="true"
          className="mx-auto size-12 text-public-success"
        />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-public-success">
          Kairos Logistics
        </p>
        <h2
          ref={successHeadingRef}
          id="logistics-success-title"
          tabIndex={-1}
          className="mt-4 font-display text-3xl font-bold text-public-primary focus:outline-none sm:text-4xl"
        >
          Заявку створено
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-public-secondary">
          {createdRequest.pricingType === 'INDIVIDUAL'
            ? 'Представник Kairos зв’яжеться з вами для уточнення деталей і погодження кінцевої суми.'
            : 'Представник Kairos підтвердить можливість виконання на вибрану дату.'}
        </p>
        <dl className="mx-auto mt-7 grid max-w-3xl gap-4 rounded-xl border border-public-border bg-public-elevated p-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-public-muted">
              Бажана дата
            </dt>
            <dd className="mt-2 text-lg font-bold text-public-primary">
              {formatDateOnlyShort(createdRequest.preferredDeliveryDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-public-muted">
              Номер заявки
            </dt>
            <dd className="mt-2 break-words text-lg font-bold text-public-primary">
              {createdRequest.requestNumber}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-public-muted">
              {createdRequest.pricingType === 'INDIVIDUAL' &&
              createdRequest.totalPrice === null
                ? 'Вартість'
                : 'Кінцева вартість'}
            </dt>
            <dd className="mt-2 break-words text-lg font-bold tabular-nums text-accent">
              {createdRequest.totalPrice === null
                ? 'Очікує індивідуального розрахунку'
                : formatServerMoney(createdRequest.totalPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-public-muted">
              Статус
            </dt>
            <dd className="mt-2 font-bold text-public-success">Нова заявка</dd>
          </div>
        </dl>
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
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.48fr)] lg:items-start xl:gap-10"
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
        <section
          aria-labelledby="logistics-city-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading id="logistics-city-section" number={1}>
            Місто відвантаження
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
          <label
            htmlFor="logistics-tariff-city"
            className={logisticsLabelClassName}
          >
            <RequiredLabel>Місто відвантаження</RequiredLabel>
            <select
              id="logistics-tariff-city"
              value={
                pricingType === 'INDIVIDUAL'
                  ? INDIVIDUAL_PRICING_SELECT_VALUE
                  : (tariffCityCode ?? '')
              }
              required
              onChange={(event) => handleCityChange(event.target.value)}
              className={logisticsFieldClassName}
            >
              <option value="">Оберіть місто</option>
              {LOGISTICS_TARIFF_CITIES.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.displayName}
                </option>
              ))}
              <option value={INDIVIDUAL_PRICING_SELECT_VALUE}>
                Інші населені пункти — Індивідуальний розрахунок
              </option>
            </select>
          </label>
          {pricingType === 'INDIVIDUAL' ? (
            <label
              htmlFor="logistics-custom-locality"
              className={`${logisticsLabelClassName} mt-4`}
            >
              <RequiredLabel>Населений пункт відвантаження</RequiredLabel>
              <input
                id="logistics-custom-locality"
                value={customLocality}
                required
                minLength={LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH}
                maxLength={LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH}
                placeholder="Наприклад: м. Черкаси або с. Стайки, Київська область"
                onChange={(event) => {
                  setCustomLocality(event.target.value);
                  clearServerFieldError('customLocality');
                }}
                onBlur={() => touch('customLocality')}
                aria-invalid={
                  serverFieldErrors.customLocality ||
                  (touchedFields.customLocality &&
                    (normalizeLogisticsCustomLocality(customLocality).length <
                      LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH ||
                      normalizeLogisticsCustomLocality(customLocality).length >
                        LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH))
                    ? true
                    : undefined
                }
                aria-describedby="logistics-custom-locality-help"
                className={logisticsFieldClassName}
              />
              {serverFieldErrors.customLocality ? (
                <span className="text-xs font-semibold text-public-danger">
                  {serverFieldErrors.customLocality}
                </span>
              ) : null}
              <span
                id="logistics-custom-locality-help"
                className="text-xs font-normal leading-5 text-public-muted"
              >
                Вкажіть населений пункт або регіон, для якого менеджер має
                розрахувати маршрут.
              </span>
            </label>
          ) : null}
          <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-public-muted">
            <TbInfoCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-accent"
            />
            <span>
            {pricingType === 'FIXED'
              ? 'Усі точки відвантаження мають знаходитися в межах вибраного тарифного міста.'
              : 'Маршрут і вартість для цього населеного пункту розрахує менеджер.'}
            </span>
          </p>
          </div>
        </section>

        <section
          aria-labelledby="logistics-pickups-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading id="logistics-pickups-section" number={2}>
            Точки відвантаження
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
          <div className="grid gap-4">
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
                  className="min-w-0 rounded-xl border border-public-border/70 bg-public-elevated/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-public-primary">
                      Точка відвантаження {index + 1}
                    </h3>
                    {index > 0 ? (
                      <button
                        type="button"
                        aria-label={`Видалити точку відвантаження ${index + 1}`}
                        onClick={() => removePickupPoint(point.id)}
                        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-public-danger/40 px-3 py-1.5 text-sm font-semibold text-public-danger transition hover:border-public-danger hover:bg-public-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-public-danger"
                      >
                        <TbTrash aria-hidden="true" className="size-4" />
                        Видалити
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
                    <div>
                    <label
                      htmlFor={`supplier-name-${point.id}`}
                      className={logisticsLabelClassName}
                    >
                    <RequiredLabel>Назва компанії / постачальника</RequiredLabel>
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
                      className={logisticsFieldClassName}
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
                    </div>

                    <div>
                    <label
                      htmlFor={`pickup-address-${point.id}`}
                      className={logisticsLabelClassName}
                    >
                    <RequiredLabel>Повна адреса завантаження</RequiredLabel>
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
                      className={logisticsFieldClassName}
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
                    </div>
                  </div>

                  <label
                    htmlFor={`cargo-description-${point.id}`}
                    className={`mt-4 ${logisticsLabelClassName}`}
                  >
                    <RequiredLabel>Опис вантажу</RequiredLabel>
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
                      className={logisticsTextareaClassName}
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
            className="mt-4 inline-flex min-h-11 w-full flex-col items-start justify-center gap-1 rounded-lg border border-accent/50 bg-accent/5 px-4 py-3 text-left transition hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold text-public-primary">
              <TbPlus aria-hidden="true" className="size-5" />
              Додати ще одну точку відвантаження
            </span>
            <span className="text-xs font-medium leading-5 text-public-muted">
              Кожна додаткова точка відвантаження: +
              {formatLogisticsPrice(ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS)} з ПДВ
            </span>
          </button>
          </div>
        </section>

        <section
          aria-labelledby="logistics-destination-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading id="logistics-destination-section" number={3}>
            Куди доставити товар?
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
          <fieldset>
            <legend className="sr-only">Оберіть місце доставки</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <DestinationRadio
              value="KAIROS_BASE"
              checked={destinationType === 'KAIROS_BASE'}
              icon={TbBuildingWarehouse}
              title="Доставити на базу Kairos"
              description={KAIROS_LOGISTICS_BASE_ADDRESS}
              supportingText="Без додаткової оплати"
              price={`Вартість: ${formatLogisticsPrice(0)}`}
              onChange={selectDestination}
            />
            <DestinationRadio
              value="FARM"
              checked={destinationType === 'FARM'}
              icon={TbTractor}
              title="Доставити в господарство"
              description="У межах Кагарлицької громади"
              price={`Додатково: +${formatLogisticsPrice(
                FARM_DELIVERY_CHARGE_MINOR_UNITS
              )} з ПДВ`}
              onChange={selectDestination}
            />
          </div>

          {destinationType === 'KAIROS_BASE' ? (
            <div className="mt-4 rounded-lg border border-public-border/70 bg-public-elevated/60 p-4">
              <a
                href={siteContacts.address.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Відкрити адресу ${KAIROS_LOGISTICS_BASE_ADDRESS} у Google Maps`}
                className="flex items-start gap-2 font-semibold text-public-primary transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <TbMapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
                {KAIROS_LOGISTICS_BASE_ADDRESS}
              </a>
              <p className="mt-2 text-sm leading-6 text-public-muted">
                Доставка до бази входить у розрахунок без додаткової оплати.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <label
                htmlFor="logistics-farm-address"
                className={logisticsLabelClassName}
              >
                <RequiredLabel>Повна адреса господарства</RequiredLabel>
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
                  className={logisticsFieldClassName}
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
          </div>
        </section>

        <section
          aria-labelledby="logistics-preferred-delivery-date-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading
            id="logistics-preferred-delivery-date-section"
            number={4}
          >
            Бажана дата перевезення
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
            <label
              htmlFor="logistics-preferred-delivery-date"
              className={logisticsLabelClassName}
            >
              <RequiredLabel>Бажана дата перевезення</RequiredLabel>
              <input
                id="logistics-preferred-delivery-date"
                name="preferredDeliveryDate"
                type="date"
                value={preferredDeliveryDate}
                min={minPreferredDeliveryDate}
                required
                onChange={(event) => {
                  setPreferredDeliveryDate(event.target.value);
                  clearServerFieldError('preferredDeliveryDate');
                }}
                onBlur={() => touch('preferredDeliveryDate')}
                aria-invalid={
                  preferredDeliveryDateInvalid ||
                  Boolean(serverFieldErrors.preferredDeliveryDate)
                    ? true
                    : undefined
                }
                aria-describedby={[
                  'logistics-preferred-delivery-date-helper',
                  preferredDeliveryDateInvalid ||
                  serverFieldErrors.preferredDeliveryDate
                    ? 'logistics-preferred-delivery-date-error'
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                className={`${logisticsFieldClassName} [color-scheme:dark]`}
              />
            </label>
            <p
              id="logistics-preferred-delivery-date-helper"
              className="mt-2 text-xs leading-5 text-public-muted"
            >
              Вкажіть бажану дату. Остаточний час виконання узгоджується з
              менеджером.
            </p>
            {preferredDeliveryDateInvalid ||
            serverFieldErrors.preferredDeliveryDate ? (
              <p
                id="logistics-preferred-delivery-date-error"
                className="mt-2 text-xs font-semibold text-public-danger"
              >
                {serverFieldErrors.preferredDeliveryDate ??
                  'Вкажіть сьогоднішню або майбутню дату перевезення.'}
              </p>
            ) : null}
          </div>
        </section>

        <section
          aria-labelledby="logistics-contact-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading id="logistics-contact-section" number={5}>
            Контактні дані
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={logisticsLabelClassName}>
              <RequiredLabel>Ім’я</RequiredLabel>
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
                className={logisticsFieldClassName}
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

            <label className={logisticsLabelClassName}>
              <RequiredLabel>Номер телефону</RequiredLabel>
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
                className={logisticsFieldClassName}
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
          </div>
        </section>

        <section
          aria-labelledby="logistics-comment-section"
          className="grid min-w-0 gap-3"
        >
          <SectionHeading id="logistics-comment-section" number={6}>
            Коментар
          </SectionHeading>
          <div className="public-card min-w-0 p-4 sm:p-6">
          <label className={logisticsLabelClassName}>
            <span className="inline-flex flex-wrap items-center gap-2">
              Коментар до заявки
              <span className="rounded-full border border-public-border px-2 py-0.5 text-xs font-medium text-public-muted">
                Необов’язково
              </span>
            </span>
            <textarea
              value={clientComment}
              maxLength={LOGISTICS_CLIENT_COMMENT_MAX_LENGTH}
              rows={5}
              onChange={(event) => setClientComment(event.target.value)}
              className={logisticsTextareaClassName}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-public-muted">
            Додайте важливі деталі щодо завантаження або перевезення.
          </p>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <aside
          aria-labelledby="logistics-price-preview-title"
          className="public-card min-w-0 p-5 sm:p-7"
        >
        {pricingType === 'INDIVIDUAL' ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Індивідуальний розрахунок
            </p>
            <h2
              id="logistics-price-preview-title"
              className="mt-3 text-2xl font-bold text-public-primary"
            >
              Вартість розрахує менеджер
            </h2>
            <p className="mt-4 text-sm leading-6 text-public-muted">
              Після надсилання заявки менеджер оцінить маршрут, кількість точок
              відвантаження, тип вантажу та місце доставки.
            </p>
            <p className="mt-3 text-sm leading-6 text-public-muted">
              Кінцева сума буде погоджена з вами до виконання перевезення.
            </p>
          </div>
        ) : (
          <>
            <h2
              id="logistics-price-preview-title"
              className="text-2xl font-bold text-public-primary"
            >
              Розрахунок вартості
            </h2>
            <p className="mt-3 text-sm leading-6 text-public-muted">
              Сума розраховується за актуальним тарифом і кількістю точок.
            </p>

        {verifiedQuote ? (
          <dl className="mt-6 grid gap-3 text-sm">
            <PriceRow
              label={`Базовий тариф — ${verifiedQuote.tariffCityName}`}
              value={formatServerMoney(verifiedQuote.baseTariff)}
            />
            <PriceRow
              label={`Додаткові точки: ${
                verifiedQuote.additionalPickupCount
              } × ${formatLogisticsPrice(
                ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS
              )}`}
              value={formatServerMoney(verifiedQuote.additionalPointsCharge)}
            />
            <PriceRow
              label="Доставка в господарство"
              value={formatServerMoney(verifiedQuote.farmDeliveryCharge)}
            />
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-public-border pt-4">
              <dt className="font-bold text-public-primary">Загальна вартість</dt>
              <dd className="shrink-0 text-xl font-bold tabular-nums text-accent">
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
              label={`Додаткові точки: ${
                preview.additionalPointCount
              } × ${formatLogisticsPrice(
                ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS
              )}`}
              value={formatLogisticsPrice(preview.additionalPointsMinorUnits)}
            />
            <PriceRow
              label="Доставка в господарство"
              value={formatLogisticsPrice(preview.farmDeliveryMinorUnits)}
            />
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-public-border pt-4">
              <dt className="font-bold text-public-primary">Загальна вартість</dt>
              <dd className="shrink-0 text-xl font-bold tabular-nums text-accent">
                {formatLogisticsPrice(preview.totalMinorUnits)}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-public-border p-4 text-sm leading-6 text-public-muted">
            Оберіть тарифне місто, щоб побачити розрахунок.
          </div>
        )}

        <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-public-primary">
          <TbCheck aria-hidden="true" className="size-5 text-public-success" />
          Усі ціни включають ПДВ
        </p>
          </>
        )}
        {pricingType === 'FIXED' &&
        quoteStatus === 'error' &&
        quoteMessage ? (
          <div
            role="alert"
            className="mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-public-danger/30 bg-public-danger/10 px-3 py-2 text-sm font-semibold text-public-danger"
          >
            <TbInfoCircle aria-hidden="true" className="size-5 shrink-0" />
            <span>{quoteMessage}</span>
          </div>
        ) : null}

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
          className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <TbTruckDelivery aria-hidden="true" className="size-5" />
          {isSubmitting
            ? 'Створюємо заявку…'
            : 'Створити заявку на перевезення'}
        </button>
        <p aria-live="polite" className="sr-only">
          {isSubmitting ? 'Заявка створюється.' : ''}
        </p>
        </aside>

        <DeliveryGuidance />
      </div>
    </form>
  );
}

function DeliveryGuidance() {
  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="logistics-restrictions-title"
        className="rounded-xl border border-public-danger/30 bg-public-elevated/60 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <TbAlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-7 shrink-0 text-public-danger"
          />
          <div className="min-w-0">
            <h2
              id="logistics-restrictions-title"
              className="font-bold text-public-primary"
            >
              Обмеження перевезень
            </h2>
            <p className="mt-3 text-sm leading-6 text-public-secondary">
              Ми не перевозимо вантажі, які:
            </p>
            <ul className="mt-2 grid gap-2 pl-5 text-sm leading-6 text-public-muted">
              {LOGISTICS_TRANSPORT_RESTRICTIONS.map((restriction, index) => (
                <li
                  key={restriction}
                  className="list-disc marker:text-public-danger"
                >
                  {restriction}
                  {index === LOGISTICS_TRANSPORT_RESTRICTIONS.length - 1
                    ? '.'
                    : ';'}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-public-border pt-4 text-sm leading-6 text-public-muted">
              Kairos Logistics залишає за собою право відмовити у виконанні
              заявки, якщо перевезення суперечить законодавству України,
              правилам безпеки або технічним можливостям сервісу.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DestinationRadio({
  value,
  checked,
  icon: Icon,
  title,
  description,
  supportingText,
  price,
  onChange
}: {
  value: LogisticsDestinationType;
  checked: boolean;
  icon: IconType;
  title: string;
  description: string;
  supportingText?: string;
  price: string;
  onChange: (value: LogisticsDestinationType) => void;
}) {
  return (
    <label
      className={`min-h-full cursor-pointer rounded-lg border p-4 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
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
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${
            checked
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-public-border bg-public-page/40 text-public-muted'
          }`}
        >
          <Icon className="size-9" />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-public-primary">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-public-muted">
            {description}
          </span>
          {supportingText ? (
            <span className="mt-1 block text-xs leading-5 text-public-muted">
              {supportingText}
            </span>
          ) : null}
          <span
            className={`mt-2 block text-sm font-bold ${
              checked ? 'text-accent' : 'text-public-secondary'
            }`}
          >
            {price}
          </span>
        </span>
      </span>
    </label>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-public-muted">{label}</dt>
      <dd className="shrink-0 font-semibold tabular-nums text-public-primary">
        {value}
      </dd>
    </div>
  );
}
