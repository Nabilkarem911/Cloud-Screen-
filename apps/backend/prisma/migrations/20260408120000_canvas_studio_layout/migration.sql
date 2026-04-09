-- Canvas Studio: layout JSON + playlist items may reference canvas or media

ALTER TABLE "Canvas" ADD COLUMN "layoutData" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Canvas" ADD COLUMN "width" INTEGER NOT NULL DEFAULT 1920;
ALTER TABLE "Canvas" ADD COLUMN "height" INTEGER NOT NULL DEFAULT 1080;
ALTER TABLE "Canvas" ALTER COLUMN "contentUrl" DROP NOT NULL;

ALTER TABLE "PlaylistItem" DROP CONSTRAINT "PlaylistItem_mediaId_fkey";

ALTER TABLE "PlaylistItem" ADD COLUMN "canvasId" TEXT;

ALTER TABLE "PlaylistItem" ALTER COLUMN "mediaId" DROP NOT NULL;

ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PlaylistItem_canvasId_idx" ON "PlaylistItem"("canvasId");

ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_media_or_canvas_chk" CHECK (
  ("mediaId" IS NOT NULL AND "canvasId" IS NULL)
  OR
  ("mediaId" IS NULL AND "canvasId" IS NOT NULL)
);
