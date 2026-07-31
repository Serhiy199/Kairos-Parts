import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type Tesseract from 'tesseract.js';

export const SERVER_OCR_LANGUAGES = 'eng+ukr';
export const SERVER_OCR_TIMEOUT_MS = 60_000;

export type OcrRuntimeErrorCode =
  | 'OCR_WORKER_NOT_PACKAGED'
  | 'OCR_WORKER_INIT_FAILED'
  | 'OCR_LANGUAGE_LOAD_FAILED'
  | 'OCR_TIMEOUT'
  | 'OCR_ENGINE_FAILED';

type ServerOcrWorker = Pick<Tesseract.Worker, 'recognize' | 'terminate'>;
type ServerOcrWorkerFactory = () => Promise<ServerOcrWorker>;

export type TesseractRuntimeAssets = {
  packageEntry: string;
  packageRoot: string;
  packageVersion: string;
  workerPath: string;
  coreEntry: string;
  coreRoot: string;
};

// Keep Node's resolver intact: Next/Webpack rewrites literal require.resolve()
// calls inside server bundles to numeric module ids, which are not filesystem paths.
const runtimeRequire = eval('require') as NodeRequire;

function resolveRuntimeModule(specifier: string) {
  const resolveMethod = Reflect.get(
    runtimeRequire,
    ['res', 'olve'].join('')
  ) as NodeRequire['resolve'];
  return Reflect.apply(resolveMethod, runtimeRequire, [specifier]) as string;
}

const USER_MESSAGES: Record<OcrRuntimeErrorCode, string> = {
  OCR_WORKER_NOT_PACKAGED: 'OCR-сервіс тимчасово недоступний. Спробуйте повторити після оновлення deployment.',
  OCR_WORKER_INIT_FAILED: 'OCR-сервіс не вдалося запустити. Спробуйте повторити пізніше.',
  OCR_LANGUAGE_LOAD_FAILED: 'OCR-сервіс не зміг завантажити мовні дані. Спробуйте повторити пізніше.',
  OCR_TIMEOUT: 'OCR перевищив дозволений час виконання.',
  OCR_ENGINE_FAILED: 'Не вдалося розпізнати текст у файлі.'
};

export class OcrRuntimeError extends Error {
  constructor(
    public readonly code: OcrRuntimeErrorCode,
    options?: { cause?: unknown; message?: string }
  ) {
    super(options?.message ?? USER_MESSAGES[code], { cause: options?.cause });
    this.name = 'OcrRuntimeError';
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function packageRootFromEntry(entry: string, expectedName: string) {
  let directory = path.dirname(entry);

  while (true) {
    const manifestPath = path.join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string;
      };
      if (manifest.name === expectedName) return directory;
    }

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new OcrRuntimeError('OCR_WORKER_NOT_PACKAGED');
}

function resolvePackageVersion(packageRoot: string) {
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
  ) as { version?: string };
  return manifest.version ?? 'unknown';
}

function resolveWorkerPath(packageRoot: string) {
  try {
    return resolveRuntimeModule(
      'tesseract.js/src/worker-script/node/index.js'
    );
  } catch {
    return path.join(
      packageRoot,
      'src',
      'worker-script',
      'node',
      'index.js'
    );
  }
}

export function resolveTesseractRuntimeAssets(): TesseractRuntimeAssets {
  try {
    const packageEntry = resolveRuntimeModule('tesseract.js');
    const packageRoot = packageRootFromEntry(packageEntry, 'tesseract.js');
    const workerPath = resolveWorkerPath(packageRoot);
    const coreEntry = resolveRuntimeModule('tesseract.js-core');
    const coreRoot = packageRootFromEntry(coreEntry, 'tesseract.js-core');
    const assets = {
      packageEntry,
      packageRoot,
      packageVersion: resolvePackageVersion(packageRoot),
      workerPath,
      coreEntry,
      coreRoot
    };

    if (!existsSync(workerPath) || !existsSync(coreEntry)) {
      throw new OcrRuntimeError('OCR_WORKER_NOT_PACKAGED');
    }
    return assets;
  } catch (error) {
    const runtimeError = error instanceof OcrRuntimeError
      ? error
      : new OcrRuntimeError('OCR_WORKER_NOT_PACKAGED', { cause: error });
    console.error('OCR runtime asset resolution failed', {
      code: runtimeError.code,
      runtime: 'nodejs',
      detail: errorText(error)
    });
    throw runtimeError;
  }
}

function isLanguageLoadFailure(error: unknown, lastStatus: string) {
  const detail = `${lastStatus} ${errorText(error)}`;
  return /language|traineddata|jsdelivr|cdn|fetch|network|enotfound|econn/i.test(detail);
}

export async function createServerOcrWorker(): Promise<ServerOcrWorker> {
  const assets = resolveTesseractRuntimeAssets();
  const languageCachePath = path.join(
    tmpdir(),
    'kairos-parts-tesseract-cache'
  );
  mkdirSync(languageCachePath, { recursive: true });
  let lastStatus = 'initializing tesseract';

  try {
    const { createWorker } = await import('tesseract.js');
    return await createWorker(SERVER_OCR_LANGUAGES, undefined, {
      workerPath: assets.workerPath,
      cachePath: languageCachePath,
      logger(message) {
        lastStatus = message.status;
      }
    });
  } catch (error) {
    const code: OcrRuntimeErrorCode = isLanguageLoadFailure(error, lastStatus)
      ? 'OCR_LANGUAGE_LOAD_FAILED'
      : 'OCR_WORKER_INIT_FAILED';
    console.error('OCR worker initialization failed', {
      code,
      runtime: 'nodejs',
      tesseractVersion: assets.packageVersion,
      workerPath: assets.workerPath,
      detail: errorText(error)
    });
    throw new OcrRuntimeError(code, { cause: error });
  }
}

export async function withServerOcrWorker<T>(
  task: (worker: ServerOcrWorker) => Promise<T>,
  workerFactory: ServerOcrWorkerFactory = createServerOcrWorker
) {
  const worker = await workerFactory();

  try {
    return await task(worker);
  } catch (error) {
    if (error instanceof OcrRuntimeError) throw error;
    throw new OcrRuntimeError('OCR_ENGINE_FAILED', { cause: error });
  } finally {
    await worker.terminate().catch((error: unknown) => {
      console.error('OCR worker termination failed', {
        code: 'OCR_ENGINE_FAILED',
        runtime: 'nodejs',
        detail: errorText(error)
      });
    });
  }
}

export async function recognizeImageBuffer(buffer: Buffer) {
  return withServerOcrWorker(async (worker) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new OcrRuntimeError('OCR_TIMEOUT'));
      }, SERVER_OCR_TIMEOUT_MS);
    });

    try {
      return await Promise.race([worker.recognize(buffer), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  });
}
