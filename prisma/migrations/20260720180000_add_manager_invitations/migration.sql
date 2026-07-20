-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MANAGER_INVITATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MANAGER_INVITATION_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'MANAGER_ACTIVATED';

-- CreateTable
CREATE TABLE "ManagerInvitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvitation_tokenHash_key" ON "ManagerInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "ManagerInvitation_userId_idx" ON "ManagerInvitation"("userId");

-- CreateIndex
CREATE INDEX "ManagerInvitation_expiresAt_idx" ON "ManagerInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "ManagerInvitation_userId_usedAt_revokedAt_idx" ON "ManagerInvitation"("userId", "usedAt", "revokedAt");

-- AddForeignKey
ALTER TABLE "ManagerInvitation" ADD CONSTRAINT "ManagerInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerInvitation" ADD CONSTRAINT "ManagerInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
