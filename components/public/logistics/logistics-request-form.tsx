'use client';

import { useMemo, useRef, useState } from 'react';
import { TbMapPin, TbPlus, TbTrash, TbTruckDelivery } from 'react-icons/tb';

import type { LogisticsResolvedAddress } from '@/lib/logistics/address-provider/contracts';
import {
  calculateLogisticsPricePreview,
  formatLogisticsPrice,
  type LogisticsDestinationType
} from '@/lib/logistics/pricing-preview';
import {
  addLogisticsPickupPoint,
  createLogisticsPickupPoint,
  invalidateLogisticsPickupAddresses,
  isLogisticsRequestDraftReady,
  LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
  LOGISTICS_CLIENT_COMMENT_MAX_LENGTH,
  LOGISTICS_CONTACT_NAME_MAX_LENGTH,
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

import { LogisticsAddressCombobox } from './logistics-address-combobox';

type LogisticsRequestFormProps = {
  initialContact: {
    name: string;
    phone: string;
  };
};

const KAIROS_BASE_ADDRESS = 'м. Кагарлик, вул. Миронівська, 33д';

export function LogisticsRequestForm({ initialContact }: LogisticsRequestFormProps) {
  const pointCounterRef = useRef(1);
  const addPointButtonRef = useRef<HTMLButtonElement>(null);
  const [tariffCityCode, setTariffCityCode] = useState<
    LogisticsTariffCityCode | null
  >(null);
  const [pickupPoints, setPickupPoints] = useState<LogisticsPickupPointDraft[]>([
    createLogisticsPickupPoint('pickup-1')
  ]);
  const [destinationType, setDestinationType] =
    useState<LogisticsDestinationType>('KAIROS_BASE');
  const [farmAddress, setFarmAddress] = useState<LogisticsResolvedAddress | null>(
    null
  );
  const [contactName, setContactName] = useState(initialContact.name);
  const [contactPhone, setContactPhone] = useState(
    formatPhoneIdentifierInput(initialContact.phone).display
  );
  const [clientComment, setClientComment] = useState('');
  const [pickupClearSignal, setPickupClearSignal] = useState(0);
  const [farmClearSignal, setFarmClearSignal] = useState(0);
  const [cityChangeNotice, setCityChangeNotice] = useState('');
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

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

  function touch(field: string) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function handleCityChange(nextCode: string) {
    const validCode = parseLogisticsTariffCitySelection(nextCode);
    const hadResolvedPickup = pickupPoints.some((point) => point.address);

    setTariffCityCode(validCode);
    setPickupPoints((current) => invalidateLogisticsPickupAddresses(current));
    setPickupClearSignal((current) => current + 1);
    setCityChangeNotice(
      hadResolvedPickup
        ? 'Адреси точок відвантаження очищено, оскільки змінено тарифне місто.'
        : ''
    );
  }

  function updatePickupPoint(
    pointId: string,
    update: Partial<Pick<LogisticsPickupPointDraft, 'address' | 'cargoDescription'>>
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
      document
        .querySelector<HTMLInputElement>(`[data-pickup-address="${point.id}"] input`)
        ?.focus();
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
    if (!transition.farmAddress) {
      setFarmClearSignal((current) => current + 1);
    }
  }

  function handlePhoneChange(value: string) {
    const formatted = formatPhoneIdentifierInput(value);
    setContactPhone(formatted.isPhoneLike ? formatted.display : value);
  }

  return (
    <form
      aria-label="Форма заявки Kairos Logistics"
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.42fr)] lg:items-start"
    >
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
            Усі точки відвантаження в одній заявці повинні знаходитися в одному
            вибраному місті.
          </p>
          <p aria-live="polite" className="mt-3 text-sm font-semibold text-accent">
            {cityChangeNotice}
          </p>
        </fieldset>

        <fieldset className="public-card min-w-0 p-5 sm:p-7">
          <legend className="px-1 text-xl font-bold text-public-primary">
            2. Точки відвантаження
          </legend>
          <div className="mt-4 grid gap-5">
            {pickupPoints.map((point, index) => {
              const cargoField = `cargo-${point.id}`;
              const cargoError =
                touchedFields[cargoField] && !point.cargoDescription.trim()
                  ? 'Опишіть, що потрібно забрати.'
                  : '';

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

                  <div
                    data-pickup-address={point.id}
                    className="mt-5"
                  >
                    <LogisticsAddressCombobox
                      label="Адреса"
                      required
                      disabled={tariffCityCode === null}
                      scope={
                        tariffCityCode === null
                          ? null
                          : { type: 'TARIFF_CITY', tariffCityCode }
                      }
                      value={point.address}
                      onResolvedChange={(address) =>
                        updatePickupPoint(point.id, { address })
                      }
                      clearSignal={pickupClearSignal}
                      helperText="Оберіть адресу зі списку та дочекайтеся підтвердження."
                    />
                  </div>

                  <label
                    htmlFor={`cargo-description-${point.id}`}
                    className="mt-5 grid gap-2 text-sm font-semibold text-public-secondary"
                  >
                    Що потрібно забрати <span aria-hidden="true">*</span>
                    <textarea
                      id={`cargo-description-${point.id}`}
                      value={point.cargoDescription}
                      required
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
                {KAIROS_BASE_ADDRESS}
              </p>
              <p className="mt-2 text-sm leading-6 text-public-muted">
                Доставка до бази входить у розрахунок без додаткової доплати.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <LogisticsAddressCombobox
                label="Адреса господарства"
                required
                scope={{ type: 'KAHARLYK_COMMUNITY' }}
                value={farmAddress}
                onResolvedChange={setFarmAddress}
                clearSignal={farmClearSignal}
                helperText="Доставка в господарство доступна в межах Кагарлицької громади."
              />
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
          Preview-only
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

        {preview ? (
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
        <div
          aria-live="polite"
          className={`mt-6 rounded-lg border p-4 text-sm font-semibold ${
            isReady
              ? 'border-public-success/30 bg-public-success/10 text-public-success'
              : 'border-public-border bg-public-elevated text-public-muted'
          }`}
        >
          {isReady
            ? 'Дані форми заповнено.'
            : 'Заповніть обов’язкові поля та підтвердьте адреси.'}
        </div>

        <button
          type="submit"
          disabled
          aria-describedby="logistics-submit-helper"
          className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary opacity-60"
        >
          <TbTruckDelivery aria-hidden="true" className="size-5" />
          Створити заявку на перевезення
        </button>
        <p
          id="logistics-submit-helper"
          className="mt-3 text-center text-xs leading-5 text-public-muted"
        >
          Надсилання заявки буде доступне на наступному етапі.
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
