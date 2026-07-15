-- Add Telegram linkage for registered clients who create requests through the bot.
ALTER TABLE "ClientProfile" ADD COLUMN "telegramUserId" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN "telegramChatId" TEXT;

CREATE UNIQUE INDEX "ClientProfile_telegramUserId_key" ON "ClientProfile"("telegramUserId");
CREATE UNIQUE INDEX "ClientProfile_telegramChatId_key" ON "ClientProfile"("telegramChatId");
