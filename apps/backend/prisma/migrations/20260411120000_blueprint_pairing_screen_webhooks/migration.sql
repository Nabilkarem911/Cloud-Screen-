-- CreateEnum
CREATE TYPE "PlayerPlatform" AS ENUM ('ANDROID', 'TIZEN', 'WEBOS', 'WEB');

-- CreateEnum
CREATE TYPE "ScreenPairingSessionStatus" AS ENUM ('PENDING', 'COMPLETE', 'EXPIRED', 'CANCELLED');

-- AlterTable PaymentRecord
ALTER TABLE "PaymentRecord" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_externalId_key" ON "PaymentRecord"("externalId");

-- AlterTable Screen
ALTER TABLE "Screen" ADD COLUMN     "playerPlatform" "PlayerPlatform" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "resolutionWidth" INTEGER NOT NULL DEFAULT 1920,
ADD COLUMN     "resolutionHeight" INTEGER NOT NULL DEFAULT 1080;

-- AlterTable Subscription
ALTER TABLE "Subscription" ADD COLUMN     "storageLimitBytes" INTEGER;

-- CreateTable ScreenPairingSession
CREATE TABLE "ScreenPairingSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pollSecret" TEXT NOT NULL,
    "status" "ScreenPairingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "workspaceId" TEXT,
    "screenId" TEXT,
    "playerPlatform" "PlayerPlatform" NOT NULL DEFAULT 'WEB',
    "resolutionWidth" INTEGER NOT NULL DEFAULT 1920,
    "resolutionHeight" INTEGER NOT NULL DEFAULT 1080,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenPairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProcessedWebhookEvent
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPairingSession_code_key" ON "ScreenPairingSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPairingSession_screenId_key" ON "ScreenPairingSession"("screenId");

-- CreateIndex
CREATE INDEX "ScreenPairingSession_status_expiresAt_idx" ON "ScreenPairingSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ScreenPairingSession_workspaceId_status_idx" ON "ScreenPairingSession"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_externalId_key" ON "ProcessedWebhookEvent"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "ScreenPairingSession" ADD CONSTRAINT "ScreenPairingSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPairingSession" ADD CONSTRAINT "ScreenPairingSession_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
