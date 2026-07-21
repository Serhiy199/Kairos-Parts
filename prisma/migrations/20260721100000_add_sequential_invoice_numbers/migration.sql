BEGIN;

-- Keep the public invoice number as text to preserve existing application,
-- PDF, Telegram, and print-view contracts while delegating allocation to
-- PostgreSQL's atomic sequence implementation.
CREATE SEQUENCE "invoice_number_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- The existing unique index can reject otherwise valid multi-row renumbering
-- when legacy values overlap the new numeric namespace. Rebuild it inside the
-- same transaction after the deterministic backfill.
DROP INDEX "Invoice_invoiceNumber_key";

WITH ordered_invoices AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequential_number
  FROM "Invoice"
)
UPDATE "Invoice" AS invoice
SET "invoiceNumber" = ordered_invoices.sequential_number::TEXT
FROM ordered_invoices
WHERE invoice."id" = ordered_invoices."id";

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- setval(..., false) makes the next nextval() return exactly N + 1.
SELECT setval(
  'invoice_number_seq',
  COALESCE((SELECT MAX("invoiceNumber"::BIGINT) FROM "Invoice"), 0) + 1,
  false
);

ALTER TABLE "Invoice"
ALTER COLUMN "invoiceNumber"
SET DEFAULT nextval('invoice_number_seq'::regclass)::TEXT;

ALTER SEQUENCE "invoice_number_seq" OWNED BY "Invoice"."invoiceNumber";

COMMIT;
