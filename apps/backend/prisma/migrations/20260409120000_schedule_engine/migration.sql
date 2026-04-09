-- Step 9: Scheduling engine + screen override

ALTER TABLE "Screen" ADD COLUMN "overridePlaylistId" TEXT;
ALTER TABLE "Screen" ADD COLUMN "overrideExpiresAt" TIMESTAMP(3);

ALTER TABLE "Screen" ADD CONSTRAINT "Screen_overridePlaylistId_fkey" FOREIGN KEY ("overridePlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "screenId" TEXT,
    "playlistId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Schedule_workspaceId_idx" ON "Schedule"("workspaceId");
CREATE INDEX "Schedule_screenId_idx" ON "Schedule"("screenId");
CREATE INDEX "Schedule_playlistId_idx" ON "Schedule"("playlistId");

ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
