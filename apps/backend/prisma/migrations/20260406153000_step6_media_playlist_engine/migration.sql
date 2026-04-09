/*
  Warnings:

  - You are about to drop the column `canvasId` on the `PlaylistItem` table. All the data in the column will be lost.
  - Added the required column `mediaId` to the `PlaylistItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `durationSec` on table `PlaylistItem` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "PlaylistItem" DROP CONSTRAINT "PlaylistItem_canvasId_fkey";

-- AlterTable
ALTER TABLE "PlaylistItem" DROP COLUMN "canvasId",
ADD COLUMN     "mediaId" TEXT NOT NULL,
ALTER COLUMN "durationSec" SET NOT NULL,
ALTER COLUMN "durationSec" SET DEFAULT 10;

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_workspaceId_createdAt_idx" ON "Media"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "PlaylistItem_mediaId_idx" ON "PlaylistItem"("mediaId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
