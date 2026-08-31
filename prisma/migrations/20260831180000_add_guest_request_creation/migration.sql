ALTER TYPE "RequestFileSource" ADD VALUE 'WEBSITE_FORM';

ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_CREATED';

ALTER TABLE "Request"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Request_idempotencyKey_key"
ON "Request"("idempotencyKey");
