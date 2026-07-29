import type { LogisticsResolvedAddress } from '@/lib/logistics/address-provider/contracts';
import type { LogisticsDestinationType } from '@/lib/logistics/pricing-preview';
import {
  isLogisticsTariffCityCode,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import { formatPhoneIdentifierInput } from '@/lib/phone/client-format';

export const LOGISTICS_CONTACT_NAME_MAX_LENGTH = 120;
export const LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH = 1_000;
export const LOGISTICS_CLIENT_COMMENT_MAX_LENGTH = 2_000;

export type LogisticsPickupPointDraft = {
  id: string;
  address: LogisticsResolvedAddress | null;
  cargoDescription: string;
};

export type LogisticsRequestFormDraft = {
  tariffCityCode: LogisticsTariffCityCode | null;
  pickupPoints: LogisticsPickupPointDraft[];
  destinationType: LogisticsDestinationType;
  farmAddress: LogisticsResolvedAddress | null;
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
    address: null,
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

export function invalidateLogisticsPickupAddresses(
  points: readonly LogisticsPickupPointDraft[]
) {
  return points.map((point) => ({ ...point, address: null }));
}

export function transitionLogisticsDestination(
  destinationType: LogisticsDestinationType,
  currentFarmAddress: LogisticsResolvedAddress | null
) {
  return {
    destinationType,
    farmAddress: destinationType === 'KAIROS_BASE' ? null : currentFarmAddress
  };
}

export function isLogisticsRequestDraftReady(draft: LogisticsRequestFormDraft) {
  const phone = formatPhoneIdentifierInput(draft.contactPhone);

  return Boolean(
    draft.tariffCityCode &&
      draft.pickupPoints.length > 0 &&
      draft.pickupPoints.every(
        (point) =>
          point.address &&
          point.cargoDescription.trim().length > 0 &&
          point.cargoDescription.trim().length <=
            LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH
      ) &&
      (draft.destinationType === 'KAIROS_BASE' || draft.farmAddress) &&
      draft.contactName.trim().length > 0 &&
      draft.contactName.trim().length <= LOGISTICS_CONTACT_NAME_MAX_LENGTH &&
      phone.canonical &&
      draft.clientComment.length <= LOGISTICS_CLIENT_COMMENT_MAX_LENGTH
  );
}
