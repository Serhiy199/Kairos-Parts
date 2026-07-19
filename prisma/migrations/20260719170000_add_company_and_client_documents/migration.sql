-- Generic Document retains requestId as a legacy fourth owner context.
-- New assisted-fleet actions create only vehicle, company, or personal-client documents.
ALTER TABLE "Document" DROP CONSTRAINT "Document_clientId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT "Document_companyId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT "Document_requestId_fkey";

ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_exactly_one_owner_check"
CHECK (
  (CASE WHEN "vehicleId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "companyId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "requestId" IS NOT NULL THEN 1 ELSE 0 END)
  = 1
);

CREATE INDEX "Document_clientId_visibleToClient_idx"
ON "Document"("clientId", "visibleToClient");

CREATE INDEX "Document_companyId_visibleToClient_idx"
ON "Document"("companyId", "visibleToClient");
