import type { LogisticsDestinationType } from '@/lib/logistics/pricing-preview';
import {
  isLogisticsTariffCityCode,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import { formatPhoneIdentifierInput } from '@/lib/phone/client-format';

export const LOGISTICS_CONTACT_NAME_MAX_LENGTH = 120;
export const LOGISTICS_SUPPLIER_NAME_MIN_LENGTH = 2;
export const LOGISTICS_SUPPLIER_NAME_MAX_LENGTH = 160;
export const LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH = 5;
export const LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH = 500;
export const LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH = 2;
export const LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH = 1_000;
export const LOGISTICS_CLIENT_COMMENT_MAX_LENGTH = 2_000;

export type LogisticsPickupPointDraft = {
  id: string;
  supplierName: string;
  address: string;
  cargoDescription: string;
};

export type LogisticsRequestFormDraft = {
  tariffCityCode: LogisticsTariffCityCode | null;
  pickupPoints: LogisticsPickupPointDraft[];
  destinationType: LogisticsDestinationType;
  farmAddress: string;
  contactName: string;
  contactPhone: string;
  clientComment: string;
};

export function parseLogisticsTariffCitySelection(
  value: string
): LogisticsTariffCityCode | null {
  return isLogisticsTariffCityCode(value) ? value : null;
}

export function createLogisticsPickupPoint(id: string): LogisticsPickupPointDraft {
  return {
    id,
    supplierName: '',
    address: '',
    cargoDescription: ''
  };
}

export function addLogisticsPickupPoint(
  points: readonly LogisticsPickupPointDraft[],
  point: LogisticsPickupPointDraft
) {
  return [...points, point];
}

export function removeLogisticsPickupPoint(
  points: readonly LogisticsPickupPointDraft[],
  pointId: string
) {
  if (points.length <= 1) {
    return [...points];
  }

  if (points[0]?.id === pointId) {
    return [...points];
  }

  const nextPoints = points.filter((point) => point.id !== pointId);
  return nextPoints.length > 0 ? nextPoints : [...points];
}

export function transitionLogisticsDestination(
  destinationType: LogisticsDestinationType,
  currentFarmAddress: string
) {
  return {
    destinationType,
    farmAddress: destinationType === 'KAIROS_BASE' ? '' : currentFarmAddress
  };
}

export function isLogisticsRequestDraftReady(draft: LogisticsRequestFormDraft) {
  const phone = formatPhoneIdentifierInput(draft.contactPhone);
  const farmAddress = draft.farmAddress.trim();

  return Boolean(
    draft.tariffCityCode &&
      draft.pickupPoints.length > 0 &&
      draft.pickupPoints.every(
        (point) => {
          const supplierName = point.supplierName.trim();
          const address = point.address.trim();
          const cargoDescription = point.cargoDescription.trim();

          return (
            supplierName.length >= LOGISTICS_SUPPLIER_NAME_MIN_LENGTH &&
            supplierName.length <= LOGISTICS_SUPPLIER_NAME_MAX_LENGTH &&
            address.length >= LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH &&
            address.length <= LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH &&
            cargoDescription.length >= LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH &&
            cargoDescription.length <= LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH
          );
        }
      ) &&
      (draft.destinationType === 'KAIROS_BASE' ||
        (farmAddress.length >= LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH &&
          farmAddress.length <= LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH)) &&
      draft.contactName.trim().length > 0 &&
      draft.contactName.trim().length <= LOGISTICS_CONTACT_NAME_MAX_LENGTH &&
      phone.canonical &&
      draft.clientComment.length <= LOGISTICS_CLIENT_COMMENT_MAX_LENGTH
  );
}
