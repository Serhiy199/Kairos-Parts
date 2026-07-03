-- CreateTable
CREATE TABLE "TelegramDraftRequest" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "phone" TEXT,
    "contactName" TEXT,
    "companyName" TEXT,
    "equipmentType" TEXT,
    "description" TEXT,
    "fileMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramDraftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramDraftRequest_telegramUserId_key" ON "TelegramDraftRequest"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramDraftRequest_chatId_idx" ON "TelegramDraftRequest"("chatId");

-- CreateIndex
CREATE INDEX "TelegramDraftRequest_step_idx" ON "TelegramDraftRequest"("step");
