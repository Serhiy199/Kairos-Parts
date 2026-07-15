-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buyerSnapshot" JSONB,
ADD COLUMN     "sellerSnapshot" JSONB;

-- CreateTable
CREATE TABLE "SellerBillingDetails" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "edrpou" TEXT,
    "ipn" TEXT,
    "iban" TEXT,
    "bankName" TEXT,
    "mfo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "legalAddress" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerBillingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBillingDetails" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
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

    CONSTRAINT "CompanyBillingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerBillingDetails_isDefault_idx" ON "SellerBillingDetails"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBillingDetails_companyId_key" ON "CompanyBillingDetails"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyBillingDetails" ADD CONSTRAINT "CompanyBillingDetails_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
