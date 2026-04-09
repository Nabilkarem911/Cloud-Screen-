-- Unify WorkspaceGroup with Playlist: organizational screen buckets use Playlist + Screen.playlistGroupId

ALTER TABLE "Screen" ADD COLUMN "playlistGroupId" TEXT;

INSERT INTO "Playlist" ("id", "workspaceId", "name", "isPublished", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  wg."workspaceId",
  wg."name",
  false,
  NOW(),
  NOW()
FROM "WorkspaceGroup" wg
WHERE NOT EXISTS (
  SELECT 1 FROM "Playlist" p
  WHERE p."workspaceId" = wg."workspaceId" AND p."name" = wg."name"
);

UPDATE "Screen" s
SET "playlistGroupId" = p."id"
FROM "WorkspaceGroup" wg
INNER JOIN "Playlist" p ON p."workspaceId" = wg."workspaceId" AND p."name" = wg."name"
WHERE s."groupId" = wg."id";

ALTER TABLE "Screen" DROP CONSTRAINT "Screen_groupId_fkey";
DROP INDEX "Screen_workspaceId_groupId_idx";
ALTER TABLE "Screen" DROP COLUMN "groupId";

DROP TABLE "WorkspaceGroup";

CREATE INDEX "Screen_workspaceId_playlistGroupId_idx" ON "Screen"("workspaceId", "playlistGroupId");

ALTER TABLE "Screen" ADD CONSTRAINT "Screen_playlistGroupId_fkey" FOREIGN KEY ("playlistGroupId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
