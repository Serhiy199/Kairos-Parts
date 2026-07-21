BEGIN;

-- Keep the public request number as text so existing UI, document, search,
-- Telegram, and notification contracts remain unchanged while PostgreSQL
-- allocates the numeric part atomically.
CREATE SEQUENCE "request_number_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Remove the unique index while every legacy value is deterministically
-- rewritten. It is recreated before the transaction commits.
DROP INDEX "Request_requestNumber_key";

WITH ordered_requests AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequential_number
  FROM "Request"
)
UPDATE "Request" AS request
SET "requestNumber" = 'KP-' || ordered_requests.sequential_number::TEXT
FROM ordered_requests
WHERE request."id" = ordered_requests."id";

CREATE UNIQUE INDEX "Request_requestNumber_key" ON "Request"("requestNumber");

-- setval(..., false) makes the next nextval() return exactly N + 1.
SELECT setval(
  'request_number_seq',
  COALESCE((SELECT MAX(SUBSTRING("requestNumber" FROM 4)::BIGINT) FROM "Request"), 0) + 1,
  false
);

ALTER TABLE "Request"
ALTER COLUMN "requestNumber"
SET DEFAULT ('KP-'::TEXT || nextval('request_number_seq'::regclass)::TEXT);

ALTER SEQUENCE "request_number_seq" OWNED BY "Request"."requestNumber";

COMMIT;
