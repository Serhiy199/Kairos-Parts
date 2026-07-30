# Stage OCR Runtime 3 — Package Tesseract worker for Next.js/Vercel

## 1. Мета

Усунути production runtime failure OCR на Vercel, зберігши чинний Node.js, Buffer-based та `eng+ukr` flow без змін Cloudinary storage, Prisma або БД.

## 2. Runtime failure

На Vercel створення Tesseract worker завершувалося помилкою:

```text
Cannot find module '/var/task/.next/worker-script/node/index.js'
```

Публічний `/api/ocr` і CRM Server Action використовують спільний `lib/ocr/service.ts`.

## 3. Root cause

У `tesseract.js@5.1.1` Node default options будують worker path через `path.join(__dirname, "..", "..", "worker-script", "node", "index.js")`. Коли пакет потрапляв у Next.js server bundle, package-relative `__dirname` втрачався, тому runtime шукав worker відносно `.next`.

Окремо build-аудит довів, що literal `require.resolve("tesseract.js")` усередині bundled application module Webpack перетворює на numeric module ID. Такий ID не є filesystem path. Adapter зберігає native Node resolver через runtime `require`, після чого викликає canonical `require.resolve`.

## 4. Current Next.js configuration

Фактична версія build: `Next.js 15.5.19`. Підтримка top-level `serverExternalPackages` і `outputFileTracingIncludes` підтверджена локальними `config-schema.js` та `config-shared.d.ts`.

Existing Prisma font tracing збережено. `output: "standalone"`, custom webpack і Turbopack overrides не додавалися.

## 5. Tesseract package structure

Використано встановлений `tesseract.js@5.1.1`:

```text
node_modules/tesseract.js/src/index.js
node_modules/tesseract.js/src/worker-script/node/index.js
node_modules/tesseract.js-core/index.js
```

Node worker імпортує common worker script, Node cache/fetch/gunzip adapter і вибирає відповідний core відповідно до SIMD/OEM.

## 6. Worker path resolution

`resolveTesseractRuntimeAssets()`:

1. виконує native Node `require.resolve("tesseract.js")`;
2. знаходить package root за найближчим `package.json` із правильним `name`;
3. пробує прямий subpath resolve Node worker;
4. якщо subpath resolve недоступний, будує шлях від підтвердженого package root;
5. перевіряє існування worker;
6. окремо resolve та перевіряє `tesseract.js-core`.

Шлях не будується від `.next`, `/var/task`, Windows drive або іншого deployment path.

## 7. Server external packages

Додано:

```ts
serverExternalPackages: [
  "tesseract.js",
  "tesseract.js-core",
]
```

Це зберігає Node package semantics для worker threads та core loader.

## 8. Output file tracing

Використано route-scoped keys для обох execution paths:

```text
/api/ocr
/admin/requests/[id]
```

Exact patterns:

```text
./node_modules/tesseract.js/src/worker-script/**
./node_modules/tesseract.js-core/**
```

Повний `node_modules/**` не включався. Existing global Prisma font patterns не змінені.

## 9. Core assets

Final build trace містить:

```text
tesseract-core-lstm.wasm
tesseract-core-simd-lstm.wasm
tesseract-core-simd.wasm
tesseract-core.wasm
```

Також traced відповідні JS/WASM loaders та `tesseract.js-core/index.js`.

## 10. Language data behavior

Без explicit `langPath` Tesseract 5.1.1 завантажує `eng` і `ukr` traineddata з jsDelivr (`@tesseract.js-data/.../4.0.0_best_int`). Traineddata не входить до function bundle і не комітиться.

Для cold start потрібен network egress. Кеш мовних даних спрямовано в `path.join(os.tmpdir(), "kairos-parts-tesseract-cache")`, що сумісно з writable temporary storage Vercel і VPS. Зображення не записується у temp file.

## 11. OCR runtime adapter

Canonical adapter:

```text
lib/ocr/tesseract-runtime.ts
```

Він централізує asset resolution, `eng+ukr`, language cache, worker creation, 60-second recognition timeout, error mapping і termination. `lib/ocr/service.ts` зберігає process-local queue та викликає лише `recognizeImageBuffer(buffer)`.

## 12. Worker lifecycle

`withServerOcrWorker()` виконує `terminate()` у `finally`. Focused test підтверджує termination після success і task failure. Timeout також проходить через той самий `finally`.

Storage failure відбувається до worker initialization, тому worker у цьому path не створюється.

## 13. Error mapping

Підтримано controlled codes:

```text
OCR_WORKER_NOT_PACKAGED
OCR_WORKER_INIT_FAILED
OCR_LANGUAGE_LOAD_FAILED
OCR_TIMEOUT
OCR_ENGINE_FAILED
```

User-facing повідомлення не містять filesystem path. Server logs містять лише технічний code/runtime/version/path/detail без file bytes, OCR text, Cloudinary URL або client PII.

## 14. Node runtime declaration

`app/api/ocr/route.ts` зберігає:

```ts
export const runtime = "nodejs";
```

CRM OCR викликається з Server Action на Node-rendered `/admin/requests/[id]`; Edge runtime не додавався.

## 15. Build output inspection

Final inspection:

```text
.next/server/app/api/ocr/route.js.nft.json:
  Node worker entries: 2 (automatic + explicit trace)
  core WASM assets: 4

.next/server/app/admin/requests/[id]/page.js.nft.json:
  Node worker entries: 2 (automatic + explicit trace)
  core WASM assets: 4
```

Production bundle зберігає native runtime resolver і не містить `.next/worker-script/node/index.js`.

## 16. Vercel compatibility

Рішення використовує підтримані Next.js 15 options, Node worker threads, function tracing та writable `os.tmpdir()`. Воно не залежить від browser worker, CDN worker script або hardcoded Vercel filesystem root.

Локальний build доводить trace contract, але остаточний Vercel function packaging і authenticated OCR request потребують staging runtime QA після deployment.

## 17. VPS compatibility

Resolver працює від installed package root, а language cache — від OS temporary directory. Тому рішення не прив’язане до Vercel і сумісне з Node.js runtime на VPS за наявності network egress або warm language cache.

## 18. Tests

Focused `test:ocr-runtime-stage3` перевіряє package/core/worker resolution, Next config, runtime declaration, source regressions, controlled lifecycle, generated in-memory PNG recognition, `eng+ukr` initialization і final `.nft.json`/bundle.

Safe fixture генерується в пам’яті; production/user image не використовувався і binary fixture не комітився.

## 19. Regression validation

Пройдено:

- Stage OCR Storage 2;
- Admin Audit Log 3, 4, 5;
- Request Approval UI 1, UI 2, Stages 3, 4, 5, 6;
- invoice presentation і Stage 6 invoice-sent flow;
- Client Vehicle Documents Stages 2, 3;
- Prisma validate;
- ESLint;
- TypeScript;
- Next.js production build.

Stage OCR Storage 2 suite додатково підтверджує upload/download/Telegram RequestFile contracts, canonical Cloudinary loader, image MIME contracts і controlled PDF blocker.

## 20. Changed files

```text
docs/reports/stage-ocr-runtime-3-package-tesseract-worker-for-nextjs-vercel.md
lib/ocr/service.ts
lib/ocr/tesseract-runtime.ts
next.config.ts
package.json
scripts/check-ocr-runtime-stage3-tesseract-worker.ts
scripts/check-ocr-storage-stage2-cloudinary-request-files.ts
```

## 21. Not changed

Не змінювалися:

- Cloudinary upload/download/delete implementation;
- RequestFile storage model і fallback policy;
- Prisma schema або migrations;
- БД і records;
- PDF OCR policy;
- auth/role/access-control;
- timeout policy;
- OCR correction persistence;
- Telegram runtime;
- production VPS configuration.

Live Cloudinary operations не виконувалися.

## 22. Known limitations

- traineddata завантажується під час cold start і потребує outbound network;
- temporary cache не гарантується між serverless instances;
- local build не є доказом authenticated Vercel runtime invocation;
- first cold OCR може мати більшу latency, ніж warm invocation.

## 23. Deployment status

На момент формування звіту code готовий до scoped commit і push у `origin/develop`. Vercel deployment та його status перевіряються після push.

## 24. Runtime QA checklist

Після успішного staging deployment:

1. увійти як ADMIN/MANAGER;
2. відкрити заявку з доступним Cloudinary image RequestFile;
3. запустити OCR для JPEG, PNG і WebP;
4. підтвердити відсутність `MODULE_NOT_FOUND` і `.next/worker-script` у logs;
5. перевірити `eng+ukr` text, confidence і OCRResult;
6. перевірити correction save;
7. перевірити controlled PDF unsupported feedback;
8. перевірити termination/timeout logs без PII.

## 25. Git state

Branch: `develop`.

Planned commit message:

```text
fix: package Tesseract worker for Vercel OCR
```

Force push заборонений. До commit мають увійти лише файли Stage OCR Runtime 3.
