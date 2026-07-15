-- CreateTable
CREATE TABLE "ClientBillingDetails" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "legalName" TEXT,
    "edrpou" TEXT,
    "ipn" TEXT,
    "iban" TEXT,
    "bankName" TEXT,
    "legalAddress" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vatPayer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBillingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBillingDetails_clientProfileId_key" ON "ClientBillingDetails"("clientProfileId");

-- AddForeignKey
ALTER TABLE "ClientBillingDetails" ADD CONSTRAINT "ClientBillingDetails_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
