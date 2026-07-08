-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChangeEntityType" AS ENUM ('REQUEST', 'REQUEST_ITEM', 'VEHICLE', 'REQUEST_DOCUMENT', 'COMMERCIAL_OFFER', 'COMPANY', 'COMPANY_PROFILE');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE');

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "entityType" "ChangeEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ChangeAction" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fieldName" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "adminComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequest_companyId_idx" ON "ChangeRequest"("companyId");

-- CreateIndex
CREATE INDEX "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ChangeRequest_reviewedById_idx" ON "ChangeRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "ChangeRequest_entityType_entityId_idx" ON "ChangeRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ChangeRequest_createdAt_idx" ON "ChangeRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
