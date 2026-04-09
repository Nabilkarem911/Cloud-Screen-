-- AlterTable
ALTER TABLE "Screen" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceGroup" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceGroup_workspaceId_idx" ON "WorkspaceGroup"("workspaceId");

-- CreateIndex
CREATE INDEX "Screen_workspaceId_groupId_idx" ON "Screen"("workspaceId", "groupId");

-- AddForeignKey
ALTER TABLE "WorkspaceGroup" ADD CONSTRAINT "WorkspaceGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WorkspaceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
