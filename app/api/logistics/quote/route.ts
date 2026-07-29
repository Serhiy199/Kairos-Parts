import {
  calculateAuthoritativeLogisticsPrice,
  serializeLogisticsMoney
} from '@/lib/logistics/pricing';
import {
  LOGISTICS_QUOTE_JSON_MAX_BYTES,
  parseLogisticsQuoteInput,
  readBoundedLogisticsJson
} from '@/lib/logistics/request-input';
import {
  logisticsRequestErrorResponse,
  logisticsRequestJson
} from '@/lib/logistics/request-responses';
import { consumeLogisticsQuoteRuntimeLimit } from '@/lib/logistics/request-security';
import { getActiveLogisticsTariff } from '@/lib/logistics/tariff-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    consumeLogisticsQuoteRuntimeLimit(request);
    const body = await readBoundedLogisticsJson(
      request,
      LOGISTICS_QUOTE_JSON_MAX_BYTES
    );
    const input = parseLogisticsQuoteInput(body);
    const tariff = await getActiveLogisticsTariff(input.tariffCityCode);
    const pricing = calculateAuthoritativeLogisticsPrice({
      baseTariff: tariff.price,
      pickupPointCount: input.pickupPointCount,
      destinationType: input.destinationType
    });

    return logisticsRequestJson({
      quote: {
        tariffCityCode: tariff.code,
        tariffCityName: tariff.name,
        pickupPointCount: input.pickupPointCount,
        additionalPickupCount: pricing.additionalPickupCount,
        destinationType: input.destinationType,
        baseTariff: serializeLogisticsMoney(pricing.baseTariff),
        additionalPointsCharge: serializeLogisticsMoney(
          pricing.additionalPointsCharge
        ),
        farmDeliveryCharge: serializeLogisticsMoney(
          pricing.farmDeliveryCharge
        ),
        totalPrice: serializeLogisticsMoney(pricing.totalPrice),
        vatIncluded: true
      }
    });
  } catch (error) {
    return logisticsRequestErrorResponse(error, 'QUOTE_UNAVAILABLE');
  }
}
