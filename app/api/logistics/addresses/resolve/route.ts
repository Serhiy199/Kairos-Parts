import { getLogisticsAddressProvider } from '@/lib/logistics/address-provider/provider-factory';
import {
  logisticsAddressErrorResponse,
  logisticsAddressJson
} from '@/lib/logistics/address-provider/responses';
import { resolveLogisticsAddress } from '@/lib/logistics/address-provider/service';
import { readBoundedLogisticsAddressJson } from '@/lib/logistics/address-provider/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await readBoundedLogisticsAddressJson(request);
    const provider = getLogisticsAddressProvider();
    const address = await resolveLogisticsAddress(provider, body);

    return logisticsAddressJson({ address });
  } catch (error) {
    return logisticsAddressErrorResponse(error);
  }
}
