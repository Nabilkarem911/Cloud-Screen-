-- Media folders + legacy workspace pairing codes (aligns DB with schema when not created via earlier migrations)

CREATE TABLE "MediaFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspacePairingCode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePairingCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Media" ADD COLUMN "folderId" TEXT;

CREATE UNIQUE INDEX "MediaFolder_workspaceId_name_key" ON "MediaFolder"("workspaceId", "name");

CREATE INDEX "MediaFolder_workspaceId_createdAt_idx" ON "MediaFolder"("workspaceId", "createdAt");

CREATE UNIQUE INDEX "WorkspacePairingCode_workspaceId_code_key" ON "WorkspacePairingCode"("workspaceId", "code");

CREATE INDEX "WorkspacePairingCode_workspaceId_isActive_createdAt_idx" ON "WorkspacePairingCode"("workspaceId", "isActive", "createdAt");

CREATE INDEX "Media_workspaceId_folderId_createdAt_idx" ON "Media"("workspaceId", "folderId", "createdAt");

ALTER TABLE "MediaFolder" ADD CONSTRAINT "MediaFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspacePairingCode" ADD CONSTRAINT "WorkspacePairingCode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media" ADD CONSTRAINT "Media_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
