import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const API_BASE_URL = 'https://developers.ria.com/agro_ria';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const USER_AGENT = 'KairosParts-RiaTaxonomyProbe/1.0';

type RiaTransportTag = {
  tag_id: number;
  name: string;
  eng?: string | null;
  [key: string]: unknown;
};

type RiaMark = {
  marka_id: number;
  name: string;
  marka?: string | null;
  marka_eng?: string | null;
  eng?: string | null;
  slang?: string | null;
  main_category?: number | null;
  category_id?: string | number | null;
  [key: string]: unknown;
};

type TestTypeDefinition = {
  label: string;
  searchTerms: string[];
};

type ManufacturerExample = {
  riaMarkId: number;
  name: string;
  eng: string | null;
  slang: string | null;
};

type TestTypeResult =
  | {
      requestedName: string;
      found: false;
    }
  | {
      requestedName: string;
      found: true;
      tagId: number;
      apiName: string;
      manufacturerCount: number;
      manufacturerExamples: ManufacturerExample[];
    };

const TEST_TYPES: TestTypeDefinition[] = [
  { label: 'Трактор', searchTerms: ['трактор'] },
  { label: 'Комбайн', searchTerms: ['комбайн'] },
  { label: 'Вантажівка', searchTerms: ['вантажів', 'вантажн'] },
  { label: 'Екскаватор', searchTerms: ['екскаватор'] },
  { label: 'Сівалка', searchTerms: ['сівал'] }
];

class RiaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'RiaApiError';
  }
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’ʼ`]/g, "'")
    .toLocaleLowerCase('uk-UA')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchJsonArray<T>(path: string, apiKey: string, parameters: Record<string, string> = {}) {
  const url = new URL(`${API_BASE_URL}/${path}/`);
  url.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });

      if (!response.ok) {
        if (attempt < MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }

        throw new RiaApiError(`RIA API request failed with HTTP ${response.status}.`, response.status);
      }

      const payload: unknown = await response.json();

      if (!Array.isArray(payload)) {
        throw new RiaApiError('RIA API returned a non-array response.');
      }

      return payload as T[];
    } catch (error) {
      if (error instanceof RiaApiError) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      const reason = error instanceof Error && error.name === 'AbortError' ? 'request timed out' : 'network request failed';
      throw new RiaApiError(`RIA API ${reason}.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new RiaApiError('RIA API request exhausted all retries.');
}

function validateTransportTags(payload: RiaTransportTag[]) {
  const invalid = payload.filter(
    (item) => !Number.isInteger(item?.tag_id) || typeof item?.name !== 'string' || item.name.trim().length === 0
  );

  if (invalid.length > 0) {
    throw new RiaApiError(`Transport tags response contains ${invalid.length} invalid item(s).`);
  }

  return payload;
}

function validateMarks(payload: RiaMark[], tagId: number) {
  const invalid = payload.filter(
    (item) => !Number.isInteger(item?.marka_id) || typeof item?.name !== 'string' || item.name.trim().length === 0
  );

  if (invalid.length > 0) {
    throw new RiaApiError(`Marks response for tag ${tagId} contains ${invalid.length} invalid item(s).`);
  }

  return payload;
}

function findTestType(types: RiaTransportTag[], definition: TestTypeDefinition) {
  return types.find((type) => {
    const searchable = normalize(`${type.name} ${type.eng ?? ''}`);
    return definition.searchTerms.some((term) => searchable.includes(normalize(term)));
  });
}

async function main() {
  const apiKey = process.env.RIA_API_KEY?.trim();

  if (!apiKey) {
    throw new RiaApiError(
      'RIA_API_KEY is missing. Add it to the process environment or a local uncommitted .env.local file.'
    );
  }

  const types = validateTransportTags(await fetchJsonArray<RiaTransportTag>('transport_tags', apiKey));
  const testResults: TestTypeResult[] = [];

  for (const definition of TEST_TYPES) {
    const type = findTestType(types, definition);

    if (!type) {
      testResults.push({ requestedName: definition.label, found: false });
      continue;
    }

    const marks = validateMarks(
      await fetchJsonArray<RiaMark>('marks', apiKey, { tag_id: String(type.tag_id) }),
      type.tag_id
    );

    testResults.push({
      requestedName: definition.label,
      found: true,
      tagId: type.tag_id,
      apiName: type.name,
      manufacturerCount: marks.length,
      manufacturerExamples: marks.slice(0, 5).map((mark) => ({
        riaMarkId: mark.marka_id,
        name: mark.name,
        eng: mark.marka_eng ?? mark.eng ?? null,
        slang: mark.slang ?? null
      }))
    });

    await sleep(250);
  }

  const successfulResults = testResults.filter(
    (result): result is Extract<TestTypeResult, { found: true }> => result.found
  );
  const distinctMarkSamples = new Set(
    successfulResults.map((result) => JSON.stringify(result.manufacturerExamples.map((mark) => mark.riaMarkId)))
  );

  const report = {
    source: 'RIA AGRO API',
    checkedAt: new Date().toISOString(),
    endpoints: {
      transportTypes: '/agro_ria/transport_tags/',
      manufacturers: '/agro_ria/marks/?tag_id=TAG_ID'
    },
    transportTypeCount: types.length,
    transportTypeShapeKeys: Array.from(new Set(types.flatMap((type) => Object.keys(type)))).sort(),
    testResults,
    marksResponsesDifferAcrossTestTypes: successfulResults.length > 1 ? distinctMarkSamples.size > 1 : null
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown RIA API probe error.';
  console.error(`[ria-probe] ${message}`);
  process.exitCode = 1;
});
