import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  OcrRuntimeError,
  SERVER_OCR_LANGUAGES,
  SERVER_OCR_TIMEOUT_MS,
  createServerOcrWorker,
  resolveTesseractRuntimeAssets,
  withServerOcrWorker
} from '../lib/ocr/tesseract-runtime';

function source(filePath: string) {
  return readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function tinySafePng() {
  const width = 160;
  const height = 48;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3, 0xff);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const dark = (x >= 20 && x <= 26 && y >= 8 && y <= 39)
        || (x >= 27 && x <= 47 && Math.abs(y - 24) <= Math.abs(x - 27) / 2)
        || (x >= 58 && x <= 120 && (y <= 13 || (y >= 21 && y <= 26) || y >= 35));
      if (dark) row.fill(0, 1 + x * 3, 1 + x * 3 + 3);
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function checkBuildTrace() {
  const tracePath = path.resolve(
    process.cwd(),
    '.next/server/app/api/ocr/route.js.nft.json'
  );
  assert.equal(
    existsSync(tracePath),
    true,
    'Run npm.cmd run build before the final Stage 3 focused check.'
  );

  const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
    files?: string[];
  };
  const files = (trace.files ?? []).map((file) => file.replaceAll('\\', '/'));
  assert.ok(
    files.some((file) => file.endsWith(
      '/node_modules/tesseract.js/src/worker-script/node/index.js'
    )),
    'OCR route trace must include the Node worker entry.'
  );
  assert.ok(
    files.some((file) => /\/node_modules\/tesseract\.js-core\/.+\.wasm$/.test(file)),
    'OCR route trace must include a Tesseract core WASM asset.'
  );

  const routeBundle = source('.next/server/app/api/ocr/route.js');
  assert.match(
    routeBundle,
    /runtimeRequire=eval\(["']require["']\)/,
    'Production bundle must retain the native Node resolver.'
  );
  assert.doesNotMatch(routeBundle, /\.next\/worker-script\/node\/index\.js/);
}

async function checkLifecycle() {
  let successTerminated = false;
  const success = await withServerOcrWorker(
    async () => 'ok',
    async () => ({
      recognize: async () => {
        throw new Error('not used');
      },
      terminate: async () => {
        successTerminated = true;
        return {} as Tesseract.ConfigResult;
      }
    })
  );
  assert.equal(success, 'ok');
  assert.equal(successTerminated, true);

  let failureTerminated = false;
  await assert.rejects(
    withServerOcrWorker(
      async () => {
        throw new Error('controlled test failure');
      },
      async () => ({
        recognize: async () => {
          throw new Error('not used');
        },
        terminate: async () => {
          failureTerminated = true;
          return {} as Tesseract.ConfigResult;
        }
      })
    ),
    (error: unknown) => error instanceof OcrRuntimeError
      && error.code === 'OCR_ENGINE_FAILED'
  );
  assert.equal(failureTerminated, true);
}

async function main() {
  const assets = resolveTesseractRuntimeAssets();
  assert.notEqual(assets.packageVersion, 'unknown');
  assert.equal(existsSync(assets.workerPath), true);
  assert.equal(existsSync(assets.coreEntry), true);
  assert.match(assets.workerPath, /tesseract\.js[\\/]src[\\/]worker-script[\\/]node[\\/]index\.js$/);
  assert.doesNotMatch(assets.workerPath, /[\\/]\.next[\\/]worker-script/);

  const nextConfig = source('next.config.ts');
  const adapter = source('lib/ocr/tesseract-runtime.ts');
  const service = source('lib/ocr/service.ts');
  const storage = source('lib/files/request-file-storage.ts');
  const apiRoute = source('app/api/ocr/route.ts');

  assert.match(nextConfig, /serverExternalPackages:[\s\S]*'tesseract\.js'[\s\S]*'tesseract\.js-core'/);
  assert.match(nextConfig, /'\/api\/ocr':[\s\S]*tesseract\.js\/src\/worker-script\/\*\*[\s\S]*tesseract\.js-core\/\*\*/);
  assert.match(nextConfig, /'\/admin\/requests\/\[id\]':[\s\S]*tesseract\.js\/src\/worker-script\/\*\*[\s\S]*tesseract\.js-core\/\*\*/);
  assert.match(nextConfig, /prisma\/build\/public\/assets\/inter-all-400-normal/);
  assert.match(nextConfig, /prisma\/build\/public\/assets\/inter-all-600-normal/);
  assert.doesNotMatch(`${nextConfig}\n${adapter}\n${service}`, /\/var\/task/);
  assert.doesNotMatch(`${adapter}\n${service}`, /\.next\/worker-script\/node\/index\.js/);

  assert.match(adapter, /resolveRuntimeModule\('tesseract\.js'\)/);
  assert.match(adapter, /resolveRuntimeModule\([\s\S]*tesseract\.js\/src\/worker-script\/node\/index\.js/);
  assert.match(adapter, /resolveRuntimeModule\('tesseract\.js-core'\)/);
  assert.match(adapter, /SERVER_OCR_LANGUAGES = 'eng\+ukr'/);
  assert.match(adapter, /tmpdir\(\)/);
  assert.match(adapter, /cachePath: languageCachePath/);
  assert.equal(SERVER_OCR_LANGUAGES, 'eng+ukr');
  assert.equal(SERVER_OCR_TIMEOUT_MS, 60_000);
  assert.match(adapter, /OCR_WORKER_NOT_PACKAGED/);
  assert.match(adapter, /OCR_WORKER_INIT_FAILED/);
  assert.match(adapter, /OCR_LANGUAGE_LOAD_FAILED/);
  assert.match(adapter, /OCR_TIMEOUT/);
  assert.match(adapter, /OCR_ENGINE_FAILED/);
  assert.match(adapter, /worker\.recognize\(buffer\)/);
  assert.match(adapter, /worker\.terminate\(\)/);

  assert.match(service, /loadRequestFileForProcessing/);
  assert.match(service, /recognizeImageBuffer\(buffer\)/);
  assert.doesNotMatch(service, /createWorker\(/);
  assert.doesNotMatch(service, /pathExists|storageKeyToLocalPath|process\.cwd\(\).*uploads/);
  assert.match(storage, /storageProvider === 'CLOUDINARY'/);
  assert.match(storage, /PDF_OCR_NOT_SUPPORTED/);
  assert.match(apiRoute, /export const runtime = 'nodejs'/);
  assert.match(service, /correctedText: input\.correctedText/);

  checkBuildTrace();
  await checkLifecycle();

  const worker = await createServerOcrWorker();
  try {
    const result = await worker.recognize(tinySafePng());
    assert.equal(typeof result.data.text, 'string');
  } finally {
    await worker.terminate();
  }

  console.log('Stage OCR Runtime 3 focused checks passed.', {
    tesseractVersion: assets.packageVersion,
    workerPath: assets.workerPath,
    coreEntry: assets.coreEntry,
    languages: SERVER_OCR_LANGUAGES
  });
}

main().catch((error) => {
  console.error('Stage OCR Runtime 3 focused checks failed.', error);
  process.exitCode = 1;
});
